-- SPDX-License-Identifier: Apache-2.0
-- Run as database owner before exposing this schema through the Data API.
CREATE SCHEMA IF NOT EXISTS nextphase_board;
CREATE TABLE IF NOT EXISTS nextphase_board.people (
  id uuid PRIMARY KEY, email text NOT NULL CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nextphase_board.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nextphase_board.workspace_members (
  workspace_id uuid REFERENCES nextphase_board.workspaces(id),
  person_id uuid REFERENCES nextphase_board.people(id),
  role text NOT NULL CHECK (role IN ('owner','editor','viewer','guest')),
  PRIMARY KEY(workspace_id, person_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_workspace_owner
  ON nextphase_board.workspace_members(workspace_id) WHERE role = 'owner';
CREATE TABLE IF NOT EXISTS nextphase_board.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES nextphase_board.workspaces(id),
  title text NOT NULL, created_by uuid NOT NULL REFERENCES nextphase_board.people(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nextphase_board.board_grants (
  board_id uuid REFERENCES nextphase_board.boards(id), person_id uuid REFERENCES nextphase_board.people(id),
  role text NOT NULL CHECK (role IN ('editor','viewer')), PRIMARY KEY(board_id, person_id)
);
CREATE TABLE IF NOT EXISTS nextphase_board.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES nextphase_board.workspaces(id),
  board_id uuid REFERENCES nextphase_board.boards(id), email text NOT NULL CHECK (email = lower(email)),
  role text NOT NULL CHECK (role IN ('editor','viewer','guest')), created_by uuid NOT NULL REFERENCES nextphase_board.people(id),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz, accepted_by uuid REFERENCES nextphase_board.people(id), cancelled_at timestamptz,
  CHECK (board_id IS NULL OR role <> 'guest')
);
CREATE TABLE IF NOT EXISTS nextphase_board.access_changes (
  number bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES nextphase_board.workspaces(id), board_id uuid REFERENCES nextphase_board.boards(id),
  person_id uuid NOT NULL REFERENCES nextphase_board.people(id), kind text NOT NULL CHECK (kind IN ('member','grant')),
  role text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nextphase_board.access_log_floor (
  workspace_id uuid PRIMARY KEY REFERENCES nextphase_board.workspaces(id), lowest_kept bigint NOT NULL DEFAULT 1
);
CREATE OR REPLACE FUNCTION nextphase_board.role_rank(role text) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE role WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 WHEN 'guest' THEN 0 ELSE -1 END
$$;
CREATE OR REPLACE FUNCTION nextphase_board.is_owner(workspace uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM nextphase_board.workspace_members m
    WHERE m.workspace_id = workspace AND m.person_id = auth.uid() AND m.role = 'owner')
$$;
CREATE OR REPLACE FUNCTION nextphase_board.board_role(person uuid, board uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN auth.role() = 'service_role' OR person = auth.uid() THEN (
    SELECT role FROM (
      SELECT m.role FROM nextphase_board.boards b JOIN nextphase_board.workspace_members m ON m.workspace_id = b.workspace_id
      WHERE b.id = board AND m.person_id = person AND m.role <> 'guest'
      UNION ALL SELECT g.role FROM nextphase_board.board_grants g WHERE g.board_id = board AND g.person_id = person
    ) roles ORDER BY nextphase_board.role_rank(role) DESC LIMIT 1
  ) ELSE NULL END
$$;
CREATE OR REPLACE FUNCTION nextphase_board.remember_person(person uuid, email text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO nextphase_board.people(id,email) VALUES(person,lower(email))
    ON CONFLICT(id) DO UPDATE SET email = excluded.email
$$;
CREATE OR REPLACE FUNCTION nextphase_board.bootstrap_workspace(name text, owner_id uuid, owner_email text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE workspace uuid;
BEGIN
  -- The unique name also serializes two simultaneous attempts to bootstrap it.
  INSERT INTO nextphase_board.workspaces(name) VALUES(name) ON CONFLICT DO NOTHING RETURNING id INTO workspace;
  IF workspace IS NULL THEN RAISE EXCEPTION 'workspace_already_owned'; END IF;
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id = workspace FOR UPDATE;
  PERFORM nextphase_board.remember_person(owner_id,owner_email);
  INSERT INTO nextphase_board.workspace_members VALUES(workspace,owner_id,'owner');
  INSERT INTO nextphase_board.access_log_floor(workspace_id) VALUES(workspace);
  INSERT INTO nextphase_board.access_changes(workspace_id,person_id,kind,role) VALUES(workspace,owner_id,'member','owner');
  RETURN workspace;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.create_board(workspace uuid, person uuid, title text) RETURNS nextphase_board.boards
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result nextphase_board.boards;
BEGIN
  INSERT INTO nextphase_board.boards(workspace_id,created_by,title) VALUES(workspace,person,title) RETURNING * INTO result;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.write_member_role(workspace uuid, person uuid, role text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_role text;
BEGIN
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id = workspace FOR UPDATE;
  SELECT m.role INTO old_role FROM nextphase_board.workspace_members m WHERE m.workspace_id = workspace AND m.person_id = person;
  IF old_role IS NULL THEN RAISE EXCEPTION 'person_not_found'; END IF;
  IF role NOT IN ('editor','viewer','guest') THEN RAISE EXCEPTION 'bad_request'; END IF;
  IF nextphase_board.role_rank(role) < nextphase_board.role_rank(old_role) THEN RAISE EXCEPTION 'lowering_not_offered'; END IF;
  IF role = old_role THEN RETURN role; END IF;
  UPDATE nextphase_board.workspace_members m SET role = write_member_role.role WHERE m.workspace_id = workspace AND m.person_id = person;
  INSERT INTO nextphase_board.access_changes(workspace_id,person_id,kind,role) VALUES(workspace,person,'member',role);
  RETURN role;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.write_board_grant(board uuid, person uuid, role text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE workspace uuid; old_role text;
BEGIN
  SELECT b.workspace_id INTO workspace FROM nextphase_board.boards b WHERE b.id = board;
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id = workspace FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM nextphase_board.people p WHERE p.id = person) THEN RAISE EXCEPTION 'person_not_found'; END IF;
  IF role NOT IN ('editor','viewer') THEN RAISE EXCEPTION 'bad_request'; END IF;
  SELECT g.role INTO old_role FROM nextphase_board.board_grants g WHERE g.board_id = board AND g.person_id = person;
  IF nextphase_board.role_rank(role) < nextphase_board.role_rank(old_role) THEN RAISE EXCEPTION 'lowering_not_offered'; END IF;
  IF old_role = role THEN RETURN role; END IF;
  IF NOT EXISTS(SELECT 1 FROM nextphase_board.workspace_members m WHERE m.workspace_id = workspace AND m.person_id = person) THEN
    INSERT INTO nextphase_board.workspace_members VALUES(workspace,person,'guest');
    INSERT INTO nextphase_board.access_changes(workspace_id,person_id,kind,role) VALUES(workspace,person,'member','guest');
  END IF;
  INSERT INTO nextphase_board.board_grants VALUES(board,person,role) ON CONFLICT(board_id,person_id) DO UPDATE SET role = excluded.role;
  INSERT INTO nextphase_board.access_changes(workspace_id,board_id,person_id,kind,role) VALUES(workspace,board,person,'grant',role);
  RETURN role;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.create_invitation(workspace uuid, board uuid, email text, role text, "by" uuid)
RETURNS nextphase_board.invitations LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result nextphase_board.invitations;
BEGIN
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id = workspace FOR UPDATE;
  IF board IS NOT NULL AND NOT EXISTS(SELECT 1 FROM nextphase_board.boards b WHERE b.id = board AND b.workspace_id = workspace) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  INSERT INTO nextphase_board.invitations(workspace_id,board_id,email,role,created_by)
    VALUES(workspace,board,lower(email),role,"by") RETURNING * INTO result;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.cancel_invitation(invitation uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE workspace uuid;
BEGIN
  SELECT i.workspace_id INTO workspace FROM nextphase_board.invitations i WHERE i.id = invitation;
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id = workspace FOR UPDATE;
  UPDATE nextphase_board.invitations i SET cancelled_at = now() WHERE i.id = invitation AND i.cancelled_at IS NULL;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.accept_invitation(invitation uuid, person uuid, email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE offer nextphase_board.invitations; old_role text; result jsonb;
BEGIN
  SELECT * INTO offer FROM nextphase_board.invitations i WHERE i.id = invitation;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id = offer.workspace_id FOR UPDATE;
  SELECT * INTO offer FROM nextphase_board.invitations i WHERE i.id = invitation FOR UPDATE;
  IF lower(email) <> offer.email THEN RAISE EXCEPTION 'invitation_email_mismatch'; END IF;
  result := jsonb_build_object('workspaceId',offer.workspace_id,'boardId',offer.board_id,'role',offer.role);
  IF offer.accepted_by = person THEN RETURN result; END IF;
  IF offer.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invitation_used'; END IF;
  IF offer.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'invitation_cancelled'; END IF;
  IF offer.expires_at <= now() THEN RAISE EXCEPTION 'invitation_expired'; END IF;
  PERFORM nextphase_board.remember_person(person,email);
  SELECT m.role INTO old_role FROM nextphase_board.workspace_members m WHERE m.workspace_id = offer.workspace_id AND m.person_id = person;
  IF old_role IS NULL THEN
    old_role := CASE WHEN offer.board_id IS NULL THEN offer.role ELSE 'guest' END;
    INSERT INTO nextphase_board.workspace_members VALUES(offer.workspace_id,person,old_role);
    INSERT INTO nextphase_board.access_changes(workspace_id,person_id,kind,role) VALUES(offer.workspace_id,person,'member',old_role);
  ELSIF offer.board_id IS NULL AND nextphase_board.role_rank(offer.role) > nextphase_board.role_rank(old_role) THEN
    PERFORM nextphase_board.write_member_role(offer.workspace_id,person,offer.role);
  END IF;
  IF offer.board_id IS NOT NULL THEN
    SELECT g.role INTO old_role FROM nextphase_board.board_grants g WHERE g.board_id = offer.board_id AND g.person_id = person;
    IF nextphase_board.role_rank(offer.role) > nextphase_board.role_rank(old_role) THEN
      PERFORM nextphase_board.write_board_grant(offer.board_id,person,offer.role);
    END IF;
  END IF;
  UPDATE nextphase_board.invitations i SET accepted_at = now(), accepted_by = person WHERE i.id = invitation;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.access_changes_after(board uuid, "after" bigint) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'changes',COALESCE((SELECT jsonb_agg(jsonb_build_object('number',c.number,'personId',c.person_id) ORDER BY c.number)
      FROM nextphase_board.access_changes c WHERE c.workspace_id = b.workspace_id AND c.number > "after" AND (c.board_id IS NULL OR c.board_id = board)), '[]'::jsonb),
    'latest',COALESCE((SELECT max(c.number) FROM nextphase_board.access_changes c WHERE c.workspace_id = b.workspace_id),0),
    'lowestKept',(SELECT f.lowest_kept FROM nextphase_board.access_log_floor f WHERE f.workspace_id = b.workspace_id))
  FROM nextphase_board.boards b WHERE b.id = board
$$;

-- Repeated runs replace policies without widening privileges.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['people','workspaces','workspace_members','boards','board_grants','invitations','access_changes','access_log_floor'] LOOP
    EXECUTE format('ALTER TABLE nextphase_board.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS read_own ON nextphase_board.%I', t);
  END LOOP;
END $$;
CREATE POLICY read_own ON nextphase_board.boards FOR SELECT TO authenticated
  USING (nextphase_board.board_role(auth.uid(),id) IS NOT NULL);
CREATE POLICY read_own ON nextphase_board.workspaces FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM nextphase_board.workspace_members m WHERE m.workspace_id = id AND m.person_id = auth.uid()));
CREATE POLICY read_own ON nextphase_board.workspace_members FOR SELECT TO authenticated
  USING (person_id = auth.uid() OR nextphase_board.is_owner(workspace_id));
CREATE POLICY read_own ON nextphase_board.board_grants FOR SELECT TO authenticated USING (
  person_id = auth.uid() OR EXISTS(SELECT 1 FROM nextphase_board.boards b WHERE b.id = board_id AND nextphase_board.is_owner(b.workspace_id)));
CREATE POLICY read_own ON nextphase_board.invitations FOR SELECT TO authenticated USING (nextphase_board.is_owner(workspace_id));
CREATE POLICY read_own ON nextphase_board.people FOR SELECT TO authenticated USING (
  id = auth.uid() OR EXISTS(SELECT 1 FROM nextphase_board.workspace_members m WHERE m.person_id = id AND nextphase_board.is_owner(m.workspace_id)));
REVOKE ALL ON ALL TABLES IN SCHEMA nextphase_board FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA nextphase_board TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA nextphase_board TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA nextphase_board TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA nextphase_board TO service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nextphase_board FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA nextphase_board TO service_role;
GRANT EXECUTE ON FUNCTION nextphase_board.board_role(uuid,uuid), nextphase_board.is_owner(uuid) TO authenticated;
