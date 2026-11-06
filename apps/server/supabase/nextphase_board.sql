-- SPDX-License-Identifier: Apache-2.0
-- Run as database owner before exposing this schema through the Data API.
CREATE SCHEMA IF NOT EXISTS nextphase_board;
CREATE TABLE IF NOT EXISTS nextphase_board.people (
  id uuid PRIMARY KEY, email text NOT NULL CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE nextphase_board.people ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;
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
-- Upgrade existing installations as well as a fresh schema.
ALTER TABLE nextphase_board.boards ADD COLUMN IF NOT EXISTS edited_at timestamptz;
UPDATE nextphase_board.boards SET edited_at = created_at WHERE edited_at IS NULL;
ALTER TABLE nextphase_board.boards ALTER COLUMN edited_at SET DEFAULT now();
ALTER TABLE nextphase_board.boards ALTER COLUMN edited_at SET NOT NULL;
ALTER TABLE nextphase_board.boards ADD COLUMN IF NOT EXISTS document_generation bigint NOT NULL DEFAULT 0;
ALTER TABLE nextphase_board.boards ADD COLUMN IF NOT EXISTS document_revision bigint NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS nextphase_board.board_opens (
  person_id uuid REFERENCES nextphase_board.people(id),
  board_id uuid REFERENCES nextphase_board.boards(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL, PRIMARY KEY(person_id, board_id)
);
CREATE INDEX IF NOT EXISTS boards_edited ON nextphase_board.boards(workspace_id, edited_at, id);
CREATE INDEX IF NOT EXISTS boards_created ON nextphase_board.boards(workspace_id, created_at, id);
CREATE INDEX IF NOT EXISTS boards_title ON nextphase_board.boards
  (workspace_id, (translate(title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') COLLATE "C"), title COLLATE "C", id);
CREATE INDEX IF NOT EXISTS opens_recent ON nextphase_board.board_opens(person_id, opened_at DESC, board_id DESC);
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
CREATE TABLE IF NOT EXISTS nextphase_board.access_deliveries (
  change_number bigint REFERENCES nextphase_board.access_changes(number) ON DELETE CASCADE,
  board_id uuid REFERENCES nextphase_board.boards(id) ON DELETE CASCADE,
  applied_at timestamptz, applied_watermark bigint, PRIMARY KEY(change_number, board_id)
);
CREATE INDEX IF NOT EXISTS unapplied_access_deliveries
  ON nextphase_board.access_deliveries(board_id, change_number) WHERE applied_at IS NULL;
CREATE OR REPLACE FUNCTION nextphase_board.deliver_access_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO nextphase_board.access_deliveries(change_number, board_id)
    SELECT NEW.number, b.id FROM nextphase_board.boards b
    WHERE b.workspace_id = NEW.workspace_id AND (NEW.board_id IS NULL OR b.id = NEW.board_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS deliver_access_change ON nextphase_board.access_changes;
CREATE TRIGGER deliver_access_change AFTER INSERT ON nextphase_board.access_changes
  FOR EACH ROW EXECUTE FUNCTION nextphase_board.deliver_access_change();
CREATE TABLE IF NOT EXISTS nextphase_board.access_log_floor (
  workspace_id uuid PRIMARY KEY REFERENCES nextphase_board.workspaces(id), lowest_kept bigint NOT NULL DEFAULT 1
);
CREATE OR REPLACE FUNCTION nextphase_board.role_rank(role text) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE role WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 WHEN 'guest' THEN 0 ELSE -1 END
$$;
CREATE OR REPLACE FUNCTION nextphase_board.is_owner(workspace uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  -- A null workspace asks only whether the caller is enabled. Keeping this in
  -- the existing definer avoids recursive people/member row policies.
  SELECT EXISTS(SELECT 1 FROM nextphase_board.people p WHERE p.id = auth.uid() AND NOT p.disabled)
    AND (workspace IS NULL OR EXISTS(SELECT 1 FROM nextphase_board.workspace_members m
      WHERE m.workspace_id = workspace AND m.person_id = auth.uid() AND m.role = 'owner'))
$$;
CREATE OR REPLACE FUNCTION nextphase_board.board_role(person uuid, board uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN (auth.role() = 'service_role' OR person = auth.uid())
    AND EXISTS(SELECT 1 FROM nextphase_board.people p WHERE p.id = person AND NOT p.disabled) THEN (
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
  IF old_role = 'owner' THEN RAISE EXCEPTION 'owner_row_immutable'; END IF;
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
  IF EXISTS(SELECT 1 FROM nextphase_board.workspace_members m
    WHERE m.workspace_id = workspace AND m.person_id = person AND m.role = 'owner') THEN
    RAISE EXCEPTION 'owner_row_immutable';
  END IF;
  IF old_role = role THEN RETURN role; END IF;
  IF NOT EXISTS(SELECT 1 FROM nextphase_board.workspace_members m WHERE m.workspace_id = workspace AND m.person_id = person) THEN
    INSERT INTO nextphase_board.workspace_members VALUES(workspace,person,'guest');
    INSERT INTO nextphase_board.access_changes(workspace_id,person_id,kind,role) VALUES(workspace,person,'member','guest');
  END IF;
  INSERT INTO nextphase_board.board_grants VALUES(board,person,role) ON CONFLICT(board_id,person_id) DO UPDATE SET role = excluded.role;
  INSERT INTO nextphase_board.access_changes(workspace_id,board_id,person_id,kind,role) VALUES(workspace,board,person,'grant',role);
  RETURN role;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.remove_member(workspace uuid, person uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_role text; has_grants boolean; new_role text;
BEGIN
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id = workspace FOR UPDATE;
  SELECT m.role INTO old_role FROM nextphase_board.workspace_members m
    WHERE m.workspace_id = workspace AND m.person_id = person;
  IF old_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF old_role = 'owner' THEN RAISE EXCEPTION 'owner_row_immutable'; END IF;
  SELECT EXISTS(SELECT 1 FROM nextphase_board.board_grants g JOIN nextphase_board.boards b ON b.id = g.board_id
    WHERE b.workspace_id = workspace AND g.person_id = person) INTO has_grants;
  IF old_role = 'guest' AND has_grants THEN RAISE EXCEPTION 'guest_has_grants'; END IF;
  IF has_grants THEN
    new_role := 'guest';
    UPDATE nextphase_board.workspace_members m SET role = new_role
      WHERE m.workspace_id = workspace AND m.person_id = person;
  ELSE
    DELETE FROM nextphase_board.workspace_members m WHERE m.workspace_id = workspace AND m.person_id = person;
  END IF;
  INSERT INTO nextphase_board.access_changes(workspace_id,person_id,kind,role) VALUES(workspace,person,'member',new_role);
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.remove_grant(board uuid, person uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE workspace uuid;
BEGIN
  SELECT b.workspace_id INTO workspace FROM nextphase_board.boards b WHERE b.id = board;
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id = workspace FOR UPDATE;
  IF EXISTS(SELECT 1 FROM nextphase_board.workspace_members m
    WHERE m.workspace_id = workspace AND m.person_id = person AND m.role = 'owner') THEN
    RAISE EXCEPTION 'owner_row_immutable';
  END IF;
  DELETE FROM nextphase_board.board_grants g WHERE g.board_id = board AND g.person_id = person;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO nextphase_board.access_changes(workspace_id,board_id,person_id,kind,role) VALUES(workspace,board,person,'grant',NULL);
  IF NOT EXISTS(SELECT 1 FROM nextphase_board.board_grants g JOIN nextphase_board.boards b ON b.id = g.board_id
    WHERE b.workspace_id = workspace AND g.person_id = person) THEN
    DELETE FROM nextphase_board.workspace_members m
      WHERE m.workspace_id = workspace AND m.person_id = person AND m.role = 'guest';
    IF FOUND THEN
      INSERT INTO nextphase_board.access_changes(workspace_id,person_id,kind,role) VALUES(workspace,person,'member',NULL);
    END IF;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.disable_person(person uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM nextphase_board.workspaces w ORDER BY w.id FOR UPDATE;
  UPDATE nextphase_board.people p SET disabled = true WHERE p.id = person AND NOT p.disabled;
  IF NOT FOUND THEN
    IF NOT EXISTS(SELECT 1 FROM nextphase_board.people p WHERE p.id = person) THEN RAISE EXCEPTION 'person_not_found'; END IF;
    RETURN;
  END IF;
  INSERT INTO nextphase_board.access_changes(workspace_id,person_id,kind,role)
    SELECT m.workspace_id, person, 'member', NULL FROM nextphase_board.workspace_members m WHERE m.person_id = person;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.enable_person(person uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM nextphase_board.workspaces w ORDER BY w.id FOR UPDATE;
  UPDATE nextphase_board.people p SET disabled = false WHERE p.id = person AND p.disabled;
  IF NOT FOUND THEN
    IF NOT EXISTS(SELECT 1 FROM nextphase_board.people p WHERE p.id = person) THEN RAISE EXCEPTION 'person_not_found'; END IF;
    RETURN;
  END IF;
  INSERT INTO nextphase_board.access_changes(workspace_id,person_id,kind,role)
    SELECT m.workspace_id, person, 'member', m.role FROM nextphase_board.workspace_members m WHERE m.person_id = person;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.record_access_receipt(board uuid, through bigint) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE nextphase_board.access_deliveries d SET applied_at = now(), applied_watermark = through
    WHERE d.board_id = board AND d.change_number <= through AND d.applied_at IS NULL
$$;
CREATE OR REPLACE FUNCTION nextphase_board.pending_access_boards() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(p.board_id ORDER BY p.board_id), '[]'::jsonb)
    FROM (SELECT DISTINCT d.board_id FROM nextphase_board.access_deliveries d WHERE d.applied_at IS NULL) p
$$;
CREATE OR REPLACE FUNCTION nextphase_board.pending_deliveries(person uuid, workspace uuid, board uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('changeNumber', d.change_number, 'boardId', d.board_id)
    ORDER BY d.change_number, d.board_id), '[]'::jsonb)
  FROM nextphase_board.access_deliveries d JOIN nextphase_board.access_changes c ON c.number = d.change_number
  WHERE d.applied_at IS NULL AND c.person_id = person
    AND (workspace IS NULL OR c.workspace_id = workspace) AND (board IS NULL OR d.board_id = board)
$$;
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
  IF EXISTS(SELECT 1 FROM nextphase_board.people p WHERE p.id = person AND p.disabled) THEN
    RAISE EXCEPTION 'account_disabled';
  END IF;
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
  IF offer.board_id IS NOT NULL AND old_role <> 'owner' THEN
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

CREATE OR REPLACE FUNCTION nextphase_board.record_board_open(person uuid, board uuid, opened_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO nextphase_board.board_opens VALUES(person, board, opened_at)
  ON CONFLICT(person_id, board_id) DO UPDATE
    SET opened_at = greatest(nextphase_board.board_opens.opened_at, excluded.opened_at)
$$;
CREATE OR REPLACE FUNCTION nextphase_board.copy_saved_board(board uuid, title text, edited_at timestamptz, generation bigint, revision bigint)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE nextphase_board.boards b SET title = copy_saved_board.title,
    edited_at = coalesce(copy_saved_board.edited_at, b.edited_at),
    document_generation = generation, document_revision = revision
  WHERE b.id = board AND (generation, revision) >= (b.document_generation, b.document_revision)
$$;
CREATE OR REPLACE FUNCTION nextphase_board.list_workspaces(person uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name, 'role', m.role)
    ORDER BY w.name COLLATE "C", w.id), '[]'::jsonb)
  FROM nextphase_board.workspaces w JOIN nextphase_board.workspace_members m ON m.workspace_id = w.id
  WHERE m.person_id = person AND EXISTS(SELECT 1 FROM nextphase_board.people p WHERE p.id = person AND NOT p.disabled)
    AND (m.role <> 'guest' OR EXISTS (
    SELECT 1 FROM nextphase_board.boards b WHERE b.workspace_id = w.id
      AND nextphase_board.board_role(person, b.id) IS NOT NULL))
$$;
CREATE OR REPLACE FUNCTION nextphase_board.list_boards(person uuid, workspace uuid, sort text, direction text, after_key text, after_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE ordering text; cursor_value text; comparison text; result jsonb;
BEGIN
  IF sort NOT IN ('edited', 'created', 'title') OR direction NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'bad_request';
  END IF;
  IF sort = 'title' THEN
    ordering := '(translate(b.title, ''ABCDEFGHIJKLMNOPQRSTUVWXYZ'', ''abcdefghijklmnopqrstuvwxyz'') COLLATE "C", b.title COLLATE "C", b.id)';
    cursor_value := '(translate($3, ''ABCDEFGHIJKLMNOPQRSTUVWXYZ'', ''abcdefghijklmnopqrstuvwxyz'') COLLATE "C", $3 COLLATE "C", $4)';
  ELSE
    ordering := CASE sort WHEN 'edited' THEN '(b.edited_at, b.id)' ELSE '(b.created_at, b.id)' END;
    cursor_value := '($3::timestamptz, $4)';
  END IF;
  comparison := CASE direction WHEN 'asc' THEN '>' ELSE '<' END;
  EXECUTE format($query$
    SELECT coalesce(jsonb_agg(page.row), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('id', b.id, 'workspaceId', b.workspace_id, 'title', b.title,
        'role', nextphase_board.board_role($1, b.id), 'createdAt', b.created_at, 'editedAt', b.edited_at,
        'openedAt', o.opened_at, 'cursorKey', %s) AS row
      FROM nextphase_board.boards b LEFT JOIN nextphase_board.board_opens o ON o.board_id = b.id AND o.person_id = $1
      WHERE b.workspace_id = $2 AND nextphase_board.board_role($1, b.id) IS NOT NULL
        AND ($3 IS NULL OR %s %s %s)
      ORDER BY %s %s LIMIT 101
    ) page
  $query$, CASE sort WHEN 'title' THEN 'b.title' WHEN 'edited' THEN 'b.edited_at::text' ELSE 'b.created_at::text' END,
    ordering, comparison, cursor_value, ordering, direction)
  INTO result USING person, workspace, after_key, after_id;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.list_recent_boards(person uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(page.row), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('id', b.id, 'workspaceId', b.workspace_id, 'workspaceName', w.name,
      'title', b.title, 'role', nextphase_board.board_role(person, b.id),
      'createdAt', b.created_at, 'editedAt', b.edited_at, 'openedAt', o.opened_at) AS row
    FROM nextphase_board.board_opens o JOIN nextphase_board.boards b ON b.id = o.board_id
      JOIN nextphase_board.workspaces w ON w.id = b.workspace_id
    WHERE o.person_id = person AND nextphase_board.board_role(person, b.id) IS NOT NULL
    ORDER BY o.opened_at DESC, b.id DESC LIMIT 50
  ) page
$$;

-- SPDX-License-Identifier: Apache-2.0
CREATE TABLE IF NOT EXISTS nextphase_board.mention_leases (
  board_id uuid REFERENCES nextphase_board.boards(id) ON DELETE CASCADE,
  person_id uuid REFERENCES nextphase_board.people(id) ON DELETE CASCADE,
  lease uuid NOT NULL DEFAULT gen_random_uuid(), PRIMARY KEY(board_id, person_id)
);
CREATE TABLE IF NOT EXISTS nextphase_board.mention_delivery (
  board_id uuid PRIMARY KEY REFERENCES nextphase_board.boards(id) ON DELETE CASCADE,
  generation bigint NOT NULL, source_order bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS nextphase_board.mention_inbox (
  id uuid PRIMARY KEY, recipient uuid NOT NULL REFERENCES nextphase_board.people(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES nextphase_board.boards(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL, comment_id uuid NOT NULL, lease uuid NOT NULL,
  generation bigint NOT NULL, source_order bigint NOT NULL, created_at bigint NOT NULL,
  delivered_order bigint GENERATED ALWAYS AS IDENTITY, is_read boolean NOT NULL DEFAULT false,
  state_version bigint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS mention_inbox_recipient_order ON nextphase_board.mention_inbox(recipient, delivered_order DESC);
CREATE INDEX IF NOT EXISTS mention_inbox_board ON nextphase_board.mention_inbox(board_id);
CREATE OR REPLACE FUNCTION nextphase_board.refresh_mention_leases(board uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM nextphase_board.boards b WHERE b.id = board FOR UPDATE;
  DELETE FROM nextphase_board.mention_leases l WHERE l.board_id = board AND nextphase_board.board_role(l.person_id, board) IS NULL;
  DELETE FROM nextphase_board.mention_inbox n WHERE n.board_id = board AND NOT EXISTS
    (SELECT 1 FROM nextphase_board.mention_leases l WHERE l.board_id = board AND l.person_id = n.recipient AND l.lease = n.lease);
  INSERT INTO nextphase_board.mention_leases(board_id,person_id)
    SELECT board,m.person_id FROM nextphase_board.boards b JOIN nextphase_board.workspace_members m ON m.workspace_id=b.workspace_id
    WHERE b.id=board AND nextphase_board.board_role(m.person_id,board) IS NOT NULL ON CONFLICT DO NOTHING;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.mention_access_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b uuid;
BEGIN
  FOR b IN SELECT id FROM nextphase_board.boards WHERE workspace_id=NEW.workspace_id AND (NEW.board_id IS NULL OR id=NEW.board_id) ORDER BY id LOOP
    PERFORM nextphase_board.refresh_mention_leases(b);
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mention_access_changed ON nextphase_board.access_changes;
CREATE TRIGGER mention_access_changed AFTER INSERT ON nextphase_board.access_changes FOR EACH ROW EXECUTE FUNCTION nextphase_board.mention_access_changed();
CREATE OR REPLACE FUNCTION nextphase_board.mention_roster(board uuid, caller uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE guest boolean; result jsonb;
BEGIN
  IF nextphase_board.board_role(caller,board) IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM nextphase_board.refresh_mention_leases(board);
  SELECT m.role='guest' INTO guest FROM nextphase_board.workspace_members m JOIN nextphase_board.boards b ON b.workspace_id=m.workspace_id WHERE m.person_id=caller AND b.id=board;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'email',p.email,'lease',l.lease)), '[]') INTO result
    FROM nextphase_board.mention_leases l JOIN nextphase_board.people p ON p.id=l.person_id
    JOIN nextphase_board.boards b ON b.id=l.board_id JOIN nextphase_board.workspace_members m ON m.workspace_id=b.workspace_id AND m.person_id=p.id
    WHERE l.board_id=board AND (NOT guest OR m.role<>'guest' OR p.id=caller) AND NOT p.disabled;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.project_mentions(board uuid, generation bigint, source_order bigint, active jsonb, creates jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE checkpoint nextphase_board.mention_delivery; item jsonb; who uuid;
BEGIN
  PERFORM 1 FROM nextphase_board.boards b WHERE b.id=board FOR UPDATE;
  SELECT * INTO checkpoint FROM nextphase_board.mention_delivery d WHERE d.board_id=board;
  IF FOUND AND (checkpoint.generation, checkpoint.source_order)>=(generation,source_order) THEN RETURN; END IF;
  IF checkpoint.generation IS NOT NULL AND checkpoint.generation<>generation THEN
    DELETE FROM nextphase_board.mention_inbox n WHERE n.board_id=board;
  END IF;
  PERFORM nextphase_board.refresh_mention_leases(board);
  DELETE FROM nextphase_board.mention_inbox n WHERE n.board_id=board AND NOT EXISTS
    (SELECT 1 FROM jsonb_array_elements(active) a WHERE (a->>'occurrence')::uuid=n.id AND (a->>'lease')::uuid=n.lease);
  FOR who IN SELECT DISTINCT (c->>'recipient')::uuid FROM jsonb_array_elements(creates) c ORDER BY 1 LOOP
    PERFORM 1 FROM nextphase_board.people p WHERE p.id=who FOR UPDATE;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(creates) ORDER BY (value->>'source_order')::bigint, value->>'occurrence' LOOP
    IF (checkpoint.generation IS NULL OR checkpoint.generation<>generation OR (item->>'source_order')::bigint>checkpoint.source_order) AND EXISTS (SELECT 1 FROM nextphase_board.mention_leases l WHERE l.board_id=board AND l.person_id=(item->>'recipient')::uuid AND l.lease=(item->>'lease')::uuid)
      AND nextphase_board.board_role((item->>'recipient')::uuid,board) IS NOT NULL THEN
      INSERT INTO nextphase_board.mention_inbox(id,recipient,board_id,thread_id,comment_id,lease,generation,source_order,created_at)
        VALUES ((item->>'occurrence')::uuid,(item->>'recipient')::uuid,board,(item->>'thread_id')::uuid,(item->>'comment_id')::uuid,(item->>'lease')::uuid,generation,(item->>'source_order')::bigint,(item->>'created_at')::bigint)
        ON CONFLICT DO NOTHING;
      DELETE FROM nextphase_board.mention_inbox n WHERE n.recipient=(item->>'recipient')::uuid AND n.id IN
        (SELECT x.id FROM nextphase_board.mention_inbox x WHERE x.recipient=n.recipient ORDER BY x.created_at DESC, x.delivered_order DESC OFFSET 50);
    END IF;
  END LOOP;
  INSERT INTO nextphase_board.mention_delivery VALUES(board,generation,source_order)
    ON CONFLICT(board_id) DO UPDATE SET generation=excluded.generation,source_order=excluded.source_order;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.clear_board_mentions(board uuid, generation bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM nextphase_board.boards b WHERE b.id=board FOR UPDATE;
  IF EXISTS(SELECT 1 FROM nextphase_board.mention_delivery d WHERE d.board_id=board AND d.generation>clear_board_mentions.generation) THEN RETURN; END IF;
  DELETE FROM nextphase_board.mention_inbox n WHERE n.board_id=board;
  INSERT INTO nextphase_board.mention_delivery VALUES(board,generation,-1) ON CONFLICT(board_id)
    DO UPDATE SET generation=excluded.generation,source_order=excluded.source_order;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.list_mentions(person uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC, n.delivered_order DESC),'[]') FROM nextphase_board.mention_inbox n
    JOIN nextphase_board.mention_leases l ON l.board_id=n.board_id AND l.person_id=n.recipient AND l.lease=n.lease
    WHERE n.recipient=person AND nextphase_board.board_role(person,n.board_id) IS NOT NULL
$$;
CREATE OR REPLACE FUNCTION nextphase_board.act_mentions(person uuid, action text, seen jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item jsonb;
BEGIN
  IF action NOT IN ('read','unread','dismiss') OR jsonb_typeof(seen)<>'array' OR jsonb_array_length(seen)>50 THEN RAISE EXCEPTION 'bad_request'; END IF;
  PERFORM 1 FROM nextphase_board.people p WHERE p.id=person FOR UPDATE;
  FOR item IN SELECT * FROM jsonb_array_elements(seen) LOOP
    IF action='dismiss' THEN DELETE FROM nextphase_board.mention_inbox n WHERE n.id=(item->>'id')::uuid AND n.recipient=person;
    ELSE UPDATE nextphase_board.mention_inbox n SET is_read=(action='read'),state_version=n.state_version+1
      WHERE n.id=(item->>'id')::uuid AND n.recipient=person AND n.state_version=(item->>'version')::bigint AND nextphase_board.board_role(person,n.board_id) IS NOT NULL; END IF;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.valid_mention_targets(board uuid, targets jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(t->>'occurrence'),'[]') FROM jsonb_array_elements(targets) t
    JOIN nextphase_board.mention_leases l ON l.board_id=board AND l.person_id=(t->>'recipient')::uuid AND l.lease=(t->>'lease')::uuid
    WHERE nextphase_board.board_role(l.person_id,board) IS NOT NULL
$$;
CREATE OR REPLACE FUNCTION nextphase_board.mention_boards()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(b.id ORDER BY b.id),'[]') FROM nextphase_board.boards b
$$;
ALTER TABLE nextphase_board.mention_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE nextphase_board.mention_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE nextphase_board.mention_inbox ENABLE ROW LEVEL SECURITY;

-- Repeated runs replace policies without widening privileges.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['people','workspaces','workspace_members','boards','board_opens','board_grants','invitations','access_changes','access_log_floor','access_deliveries'] LOOP
    EXECUTE format('ALTER TABLE nextphase_board.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS read_own ON nextphase_board.%I', t);
  END LOOP;
END $$;
CREATE POLICY read_own ON nextphase_board.board_opens FOR SELECT TO authenticated USING (nextphase_board.is_owner(NULL) AND person_id = auth.uid());
CREATE POLICY read_own ON nextphase_board.boards FOR SELECT TO authenticated
  USING (nextphase_board.board_role(auth.uid(),id) IS NOT NULL);
CREATE POLICY read_own ON nextphase_board.workspaces FOR SELECT TO authenticated USING (
  nextphase_board.is_owner(NULL) AND EXISTS(SELECT 1 FROM nextphase_board.workspace_members m WHERE m.workspace_id = id AND m.person_id = auth.uid()));
CREATE POLICY read_own ON nextphase_board.workspace_members FOR SELECT TO authenticated
  USING (nextphase_board.is_owner(NULL) AND (person_id = auth.uid() OR nextphase_board.is_owner(workspace_id)));
CREATE POLICY read_own ON nextphase_board.board_grants FOR SELECT TO authenticated USING (nextphase_board.is_owner(NULL) AND (
  person_id = auth.uid() OR EXISTS(SELECT 1 FROM nextphase_board.boards b WHERE b.id = board_id AND nextphase_board.is_owner(b.workspace_id))));
CREATE POLICY read_own ON nextphase_board.invitations FOR SELECT TO authenticated USING (nextphase_board.is_owner(workspace_id));
CREATE POLICY read_own ON nextphase_board.people FOR SELECT TO authenticated USING (nextphase_board.is_owner(NULL) AND (
  id = auth.uid() OR EXISTS(SELECT 1 FROM nextphase_board.workspace_members m WHERE m.person_id = id AND nextphase_board.is_owner(m.workspace_id))));
REVOKE ALL ON ALL TABLES IN SCHEMA nextphase_board FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA nextphase_board TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA nextphase_board TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA nextphase_board TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA nextphase_board TO service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nextphase_board FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA nextphase_board TO service_role;
GRANT EXECUTE ON FUNCTION nextphase_board.board_role(uuid,uuid), nextphase_board.is_owner(uuid) TO authenticated;
