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
-- Lifecycle authority is independent of recoverable room databases.
CREATE TABLE IF NOT EXISTS nextphase_board.board_lifecycle (
  board_id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES nextphase_board.workspaces(id),
  state text NOT NULL CHECK(state IN ('active','moving','trashed','restoring','purging')),
  cycle bigint NOT NULL CHECK(cycle BETWEEN 0 AND 9007199254740991),
  generation bigint NOT NULL CHECK(generation BETWEEN 0 AND 9007199254740991),
  deleted_at bigint CHECK(deleted_at BETWEEN 0 AND 9007196662740991),
  restore_before bigint CHECK(restore_before BETWEEN 0 AND 9007199254740991),
  operation_id uuid, phase text NOT NULL CHECK(phase IN ('idle','admitted','room_fenced','delivery_cleared','access_ready','room_removed','sql_removed')),
  next_attempt_at bigint CHECK(next_attempt_at BETWEEN 0 AND 9007199254740991),
  CHECK((state IN ('active','trashed') AND phase='idle' AND operation_id IS NULL AND next_attempt_at IS NULL) OR
    (state='moving' AND phase IN ('admitted','room_fenced','delivery_cleared') AND operation_id IS NOT NULL AND next_attempt_at IS NOT NULL) OR
    (state='restoring' AND phase IN ('admitted','room_fenced','access_ready') AND operation_id IS NOT NULL AND next_attempt_at IS NOT NULL) OR
    (state='purging' AND phase IN ('admitted','room_removed','sql_removed') AND operation_id IS NOT NULL AND next_attempt_at IS NOT NULL)),
  CHECK((state IN ('active','purging') AND deleted_at IS NULL AND restore_before IS NULL) OR
    (state IN ('moving','trashed','restoring') AND deleted_at IS NOT NULL AND restore_before=deleted_at+2592000000))
);
CREATE TABLE IF NOT EXISTS nextphase_board.board_lifecycle_requests (
  board_id uuid NOT NULL, person_id uuid NOT NULL, request_id uuid NOT NULL, operation_id uuid NOT NULL UNIQUE,
  operation text NOT NULL CHECK(operation IN ('move','restore','purge')),
  expected_cycle bigint NOT NULL CHECK(expected_cycle BETWEEN 0 AND 9007199254740991),
  accepted_cycle bigint NOT NULL CHECK(accepted_cycle BETWEEN 0 AND 9007199254740991),
  digest text NOT NULL CHECK(digest ~ '^[0-9a-f]{64}$'),
  result text NOT NULL CHECK(octet_length(result)<=65536 AND jsonb_typeof(result::jsonb)='object'),
  PRIMARY KEY(board_id,person_id,request_id),
  CHECK(octet_length(jsonb_build_object('board_id',board_id,'person_id',person_id,'request_id',request_id,'operation_id',operation_id,'operation',operation,'expected_cycle',expected_cycle,'accepted_cycle',accepted_cycle,'digest',digest,'result',result)::text)<131072)
);
CREATE TABLE IF NOT EXISTS nextphase_board.deleted_board_ids (
  board_id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES nextphase_board.workspaces(id),
  generation bigint NOT NULL CHECK(generation BETWEEN 0 AND 9007199254740991)
);
CREATE INDEX IF NOT EXISTS lifecycle_due ON nextphase_board.board_lifecycle(next_attempt_at,board_id);
CREATE INDEX IF NOT EXISTS lifecycle_trash ON nextphase_board.board_lifecycle(workspace_id,deleted_at DESC,board_id);
ALTER TABLE nextphase_board.board_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE nextphase_board.board_lifecycle_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE nextphase_board.deleted_board_ids ENABLE ROW LEVEL SECURITY;
-- Every directory insertion establishes authority in that same transaction, including
-- service-side bulk creation. A missing row later still fails closed; this is not backfill.
CREATE OR REPLACE FUNCTION nextphase_board.initialize_board_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM nextphase_board.deleted_board_ids d WHERE d.board_id=NEW.id) THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO nextphase_board.board_lifecycle VALUES(NEW.id,NEW.workspace_id,'active',0,0,NULL,NULL,NULL,'idle',NULL)
    ON CONFLICT(board_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS initialize_board_lifecycle ON nextphase_board.boards;
CREATE TRIGGER initialize_board_lifecycle AFTER INSERT ON nextphase_board.boards
  FOR EACH ROW EXECUTE FUNCTION nextphase_board.initialize_board_lifecycle();
CREATE OR REPLACE FUNCTION nextphase_board.board_active(board uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_life nextphase_board.board_lifecycle;
BEGIN
  IF EXISTS(SELECT 1 FROM nextphase_board.deleted_board_ids d WHERE d.board_id=board_active.board) THEN RETURN false; END IF;
  SELECT * INTO v_life FROM nextphase_board.board_lifecycle l WHERE l.board_id=board_active.board;
  IF NOT FOUND AND EXISTS(SELECT 1 FROM nextphase_board.boards b WHERE b.id=board_active.board) THEN RAISE EXCEPTION 'service_unavailable'; END IF;
  RETURN coalesce(v_life.state='active',false);
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.board_role(person uuid, board uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN (auth.role() = 'service_role' OR board_role.person = auth.uid())
    AND EXISTS(SELECT 1 FROM nextphase_board.people p WHERE p.id = board_role.person AND NOT p.disabled)
    AND nextphase_board.board_active(board_role.board) THEN (
    SELECT role FROM (
      SELECT m.role FROM nextphase_board.boards b JOIN nextphase_board.workspace_members m ON m.workspace_id = b.workspace_id
      WHERE b.id = board_role.board AND m.person_id = board_role.person AND m.role <> 'guest'
      UNION ALL SELECT g.role FROM nextphase_board.board_grants g WHERE g.board_id = board_role.board AND g.person_id = board_role.person
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
DROP FUNCTION IF EXISTS nextphase_board.create_board(uuid, uuid, text);
CREATE OR REPLACE FUNCTION nextphase_board.create_board(workspace uuid, person uuid, title text, board uuid DEFAULT NULL) RETURNS nextphase_board.boards
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result nextphase_board.boards; v_role text;
BEGIN
  IF create_board.board IS NOT NULL THEN
    PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id=create_board.workspace FOR UPDATE;
    SELECT m.role INTO v_role FROM nextphase_board.workspace_members m
      JOIN nextphase_board.people p ON p.id=m.person_id AND NOT p.disabled
      WHERE m.workspace_id=create_board.workspace AND m.person_id=create_board.person;
    IF v_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
    IF v_role NOT IN ('owner','editor') THEN RAISE EXCEPTION 'role_too_low' USING DETAIL='editor'; END IF;
    IF EXISTS(SELECT 1 FROM nextphase_board.boards b WHERE b.id=create_board.board) THEN RAISE EXCEPTION 'board_exists'; END IF;
    IF EXISTS(SELECT 1 FROM nextphase_board.deleted_board_ids d WHERE d.board_id=create_board.board) THEN RAISE EXCEPTION 'service_unavailable'; END IF;
    INSERT INTO nextphase_board.boards(id,workspace_id,created_by,title)
      VALUES(create_board.board,create_board.workspace,create_board.person,create_board.title) RETURNING * INTO v_result;
    RETURN v_result;
  END IF;
  INSERT INTO nextphase_board.boards(workspace_id,created_by,title) VALUES(create_board.workspace,create_board.person,create_board.title) RETURNING * INTO v_result;
  IF EXISTS(SELECT 1 FROM nextphase_board.deleted_board_ids d WHERE d.board_id=v_result.id) THEN RAISE EXCEPTION 'service_unavailable'; END IF;
  RETURN v_result;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.discard_import(board uuid, workspace uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Serialize cleanup with a create_board call that may still be in flight.
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id=discard_import.workspace FOR UPDATE;
  INSERT INTO nextphase_board.deleted_board_ids(board_id,workspace_id,generation)
    VALUES(discard_import.board,discard_import.workspace,0) ON CONFLICT (board_id) DO NOTHING;
  DELETE FROM nextphase_board.boards b WHERE b.id=discard_import.board AND b.workspace_id=discard_import.workspace;
  DELETE FROM nextphase_board.board_lifecycle l WHERE l.board_id=discard_import.board AND l.workspace_id=discard_import.workspace;
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
DECLARE v_workspace uuid; v_old_role text;
BEGIN
  SELECT b.workspace_id INTO v_workspace FROM nextphase_board.boards b WHERE b.id = write_board_grant.board;
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id = v_workspace FOR UPDATE;
  IF NOT nextphase_board.board_active(write_board_grant.board) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT EXISTS(SELECT 1 FROM nextphase_board.people p WHERE p.id = write_board_grant.person) THEN RAISE EXCEPTION 'person_not_found'; END IF;
  IF write_board_grant.role NOT IN ('editor','viewer') THEN RAISE EXCEPTION 'bad_request'; END IF;
  SELECT g.role INTO v_old_role FROM nextphase_board.board_grants g WHERE g.board_id = write_board_grant.board AND g.person_id = write_board_grant.person;
  IF EXISTS(SELECT 1 FROM nextphase_board.workspace_members m
    WHERE m.workspace_id = v_workspace AND m.person_id = write_board_grant.person AND m.role = 'owner') THEN
    RAISE EXCEPTION 'owner_row_immutable';
  END IF;
  IF v_old_role = write_board_grant.role THEN RETURN write_board_grant.role; END IF;
  IF NOT EXISTS(SELECT 1 FROM nextphase_board.workspace_members m WHERE m.workspace_id = v_workspace AND m.person_id = write_board_grant.person) THEN
    INSERT INTO nextphase_board.workspace_members VALUES(v_workspace,write_board_grant.person,'guest');
    INSERT INTO nextphase_board.access_changes(workspace_id,person_id,kind,role) VALUES(v_workspace,write_board_grant.person,'member','guest');
  END IF;
  INSERT INTO nextphase_board.board_grants VALUES(write_board_grant.board,write_board_grant.person,write_board_grant.role) ON CONFLICT(board_id,person_id) DO UPDATE SET role = excluded.role;
  INSERT INTO nextphase_board.access_changes(workspace_id,board_id,person_id,kind,role) VALUES(v_workspace,write_board_grant.board,write_board_grant.person,'grant',write_board_grant.role);
  RETURN write_board_grant.role;
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
DECLARE v_result nextphase_board.invitations;
BEGIN
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id = create_invitation.workspace FOR UPDATE;
  IF create_invitation.board IS NOT NULL AND NOT EXISTS(SELECT 1 FROM nextphase_board.boards b WHERE b.id = create_invitation.board AND b.workspace_id = create_invitation.workspace AND nextphase_board.board_active(create_invitation.board)) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  INSERT INTO nextphase_board.invitations(workspace_id,board_id,email,role,created_by)
    VALUES(create_invitation.workspace,create_invitation.board,lower(create_invitation.email),create_invitation.role,create_invitation."by") RETURNING * INTO v_result;
  RETURN v_result;
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
DECLARE v_offer nextphase_board.invitations; v_old_role text; v_result jsonb;
BEGIN
  SELECT * INTO v_offer FROM nextphase_board.invitations i WHERE i.id = accept_invitation.invitation;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id = v_offer.workspace_id FOR UPDATE;
  SELECT * INTO v_offer FROM nextphase_board.invitations i WHERE i.id = accept_invitation.invitation FOR UPDATE;
  IF EXISTS(SELECT 1 FROM nextphase_board.people p WHERE p.id = accept_invitation.person AND p.disabled) THEN
    RAISE EXCEPTION 'account_disabled';
  END IF;
  IF v_offer.board_id IS NOT NULL AND NOT nextphase_board.board_active(v_offer.board_id) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF lower(accept_invitation.email) <> v_offer.email THEN RAISE EXCEPTION 'invitation_email_mismatch'; END IF;
  v_result := jsonb_build_object('workspaceId',v_offer.workspace_id,'boardId',v_offer.board_id,'role',v_offer.role);
  IF v_offer.accepted_by = accept_invitation.person THEN RETURN v_result; END IF;
  IF v_offer.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invitation_used'; END IF;
  IF v_offer.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'invitation_cancelled'; END IF;
  IF v_offer.expires_at <= now() THEN RAISE EXCEPTION 'invitation_expired'; END IF;
  PERFORM nextphase_board.remember_person(accept_invitation.person,accept_invitation.email);
  SELECT m.role INTO v_old_role FROM nextphase_board.workspace_members m WHERE m.workspace_id = v_offer.workspace_id AND m.person_id = accept_invitation.person;
  IF v_old_role IS NULL THEN
    v_old_role := CASE WHEN v_offer.board_id IS NULL THEN v_offer.role ELSE 'guest' END;
    INSERT INTO nextphase_board.workspace_members VALUES(v_offer.workspace_id,accept_invitation.person,v_old_role);
    INSERT INTO nextphase_board.access_changes(workspace_id,person_id,kind,role) VALUES(v_offer.workspace_id,accept_invitation.person,'member',v_old_role);
  ELSIF v_offer.board_id IS NULL AND nextphase_board.role_rank(v_offer.role) > nextphase_board.role_rank(v_old_role) THEN
    PERFORM nextphase_board.write_member_role(v_offer.workspace_id,accept_invitation.person,v_offer.role);
  END IF;
  IF v_offer.board_id IS NOT NULL AND v_old_role <> 'owner' THEN
    SELECT g.role INTO v_old_role FROM nextphase_board.board_grants g WHERE g.board_id = v_offer.board_id AND g.person_id = accept_invitation.person;
    IF nextphase_board.role_rank(v_offer.role) > nextphase_board.role_rank(v_old_role) THEN
      PERFORM nextphase_board.write_board_grant(v_offer.board_id,accept_invitation.person,v_offer.role);
    END IF;
  END IF;
  UPDATE nextphase_board.invitations i SET accepted_at = now(), accepted_by = accept_invitation.person WHERE i.id = accept_invitation.invitation;
  RETURN v_result;
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
  INSERT INTO nextphase_board.board_opens SELECT record_board_open.person, record_board_open.board, record_board_open.opened_at WHERE nextphase_board.board_role(record_board_open.person,record_board_open.board) IS NOT NULL
  ON CONFLICT(person_id, board_id) DO UPDATE
    SET opened_at = greatest(nextphase_board.board_opens.opened_at, excluded.opened_at)
$$;
CREATE OR REPLACE FUNCTION nextphase_board.copy_saved_board(board uuid, title text, edited_at timestamptz, generation bigint, revision bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_w uuid;
BEGIN
  SELECT b.workspace_id INTO v_w FROM nextphase_board.boards b WHERE b.id=copy_saved_board.board;
  PERFORM 1 FROM nextphase_board.workspaces x WHERE x.id=v_w FOR UPDATE;
  PERFORM 1 FROM nextphase_board.board_lifecycle l WHERE l.board_id=copy_saved_board.board FOR UPDATE;
  IF NOT nextphase_board.board_active(copy_saved_board.board) THEN RETURN; END IF;
  UPDATE nextphase_board.boards b SET title=copy_saved_board.title,edited_at=coalesce(copy_saved_board.edited_at,b.edited_at),document_generation=copy_saved_board.generation,document_revision=copy_saved_board.revision
  WHERE b.id=copy_saved_board.board AND copy_saved_board.generation>=(SELECT l.generation FROM nextphase_board.board_lifecycle l WHERE l.board_id=copy_saved_board.board) AND (copy_saved_board.generation,copy_saved_board.revision)>=(b.document_generation,b.document_revision);
END $$;
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
DECLARE v_checkpoint nextphase_board.mention_delivery; v_item jsonb; v_who uuid;
BEGIN
  PERFORM 1 FROM nextphase_board.boards b WHERE b.id=project_mentions.board FOR UPDATE;
  IF NOT nextphase_board.board_active(project_mentions.board) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF project_mentions.generation < (SELECT l.generation FROM nextphase_board.board_lifecycle l WHERE l.board_id=project_mentions.board) THEN RETURN; END IF;
  SELECT * INTO v_checkpoint FROM nextphase_board.mention_delivery d WHERE d.board_id=project_mentions.board;
  IF FOUND AND (v_checkpoint.generation, v_checkpoint.source_order)>=(project_mentions.generation,project_mentions.source_order) THEN RETURN; END IF;
  IF v_checkpoint.generation IS NOT NULL AND v_checkpoint.generation<>project_mentions.generation THEN
    DELETE FROM nextphase_board.mention_inbox n WHERE n.board_id=project_mentions.board;
  END IF;
  PERFORM nextphase_board.refresh_mention_leases(project_mentions.board);
  DELETE FROM nextphase_board.mention_inbox n WHERE n.board_id=project_mentions.board AND NOT EXISTS
    (SELECT 1 FROM jsonb_array_elements(project_mentions.active) a WHERE (a->>'occurrence')::uuid=n.id AND (a->>'lease')::uuid=n.lease);
  FOR v_who IN SELECT DISTINCT (c->>'recipient')::uuid FROM jsonb_array_elements(project_mentions.creates) c ORDER BY 1 LOOP
    PERFORM 1 FROM nextphase_board.people p WHERE p.id=v_who FOR UPDATE;
  END LOOP;
  FOR v_item IN SELECT * FROM jsonb_array_elements(project_mentions.creates) ORDER BY (value->>'source_order')::bigint, value->>'occurrence' LOOP
    IF (v_checkpoint.generation IS NULL OR v_checkpoint.generation<>project_mentions.generation OR (v_item->>'source_order')::bigint>v_checkpoint.source_order) AND EXISTS (SELECT 1 FROM nextphase_board.mention_leases l WHERE l.board_id=project_mentions.board AND l.person_id=(v_item->>'recipient')::uuid AND l.lease=(v_item->>'lease')::uuid)
      AND nextphase_board.board_role((v_item->>'recipient')::uuid,project_mentions.board) IS NOT NULL THEN
      INSERT INTO nextphase_board.mention_inbox(id,recipient,board_id,thread_id,comment_id,lease,generation,source_order,created_at)
        VALUES ((v_item->>'occurrence')::uuid,(v_item->>'recipient')::uuid,project_mentions.board,(v_item->>'thread_id')::uuid,(v_item->>'comment_id')::uuid,(v_item->>'lease')::uuid,project_mentions.generation,(v_item->>'source_order')::bigint,(v_item->>'created_at')::bigint)
        ON CONFLICT DO NOTHING;
      DELETE FROM nextphase_board.mention_inbox n WHERE n.recipient=(v_item->>'recipient')::uuid AND n.id IN
        (SELECT x.id FROM nextphase_board.mention_inbox x WHERE x.recipient=n.recipient ORDER BY x.created_at DESC, x.delivered_order DESC OFFSET 50);
    END IF;
  END LOOP;
  INSERT INTO nextphase_board.mention_delivery VALUES(project_mentions.board,project_mentions.generation,project_mentions.source_order)
    ON CONFLICT(board_id) DO UPDATE SET generation=excluded.generation,source_order=excluded.source_order;
END $$;
-- User document restore preserves the delivered cutoff and every retained read state.
CREATE OR REPLACE FUNCTION nextphase_board.carry_board_mentions(board uuid, from_generation bigint, to_generation bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_checkpoint nextphase_board.mention_delivery;
BEGIN
  IF NOT nextphase_board.board_active(carry_board_mentions.board) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF carry_board_mentions.from_generation IS NULL OR carry_board_mentions.to_generation IS NULL OR carry_board_mentions.from_generation < 0 OR carry_board_mentions.to_generation <= carry_board_mentions.from_generation OR carry_board_mentions.to_generation > 9007199254740991 THEN RAISE EXCEPTION 'bad_request'; END IF;
  PERFORM 1 FROM nextphase_board.boards b WHERE b.id=carry_board_mentions.board FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO v_checkpoint FROM nextphase_board.mention_delivery d WHERE d.board_id=carry_board_mentions.board;
  IF FOUND THEN
    IF v_checkpoint.generation=carry_board_mentions.to_generation THEN RETURN; END IF;
    IF v_checkpoint.generation<>carry_board_mentions.from_generation THEN RAISE EXCEPTION 'generation_conflict'; END IF;
    UPDATE nextphase_board.mention_delivery d SET generation=carry_board_mentions.to_generation WHERE d.board_id=carry_board_mentions.board;
  ELSE
    INSERT INTO nextphase_board.mention_delivery VALUES(carry_board_mentions.board,carry_board_mentions.to_generation,-1);
  END IF;
  UPDATE nextphase_board.mention_inbox n SET generation=carry_board_mentions.to_generation WHERE n.board_id=carry_board_mentions.board;
  PERFORM nextphase_board.refresh_mention_leases(carry_board_mentions.board);
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
  SELECT coalesce(jsonb_agg(b.id ORDER BY b.id),'[]') FROM nextphase_board.boards b WHERE nextphase_board.board_active(b.id)
$$;
ALTER TABLE nextphase_board.mention_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE nextphase_board.mention_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE nextphase_board.mention_inbox ENABLE ROW LEVEL SECURITY;

-- Function parameters are function-qualified; local variables use v_ to avoid SQL column capture.
-- Service-only lifecycle calls. Workspace lock precedes lifecycle and board locks.
CREATE OR REPLACE FUNCTION nextphase_board.lifecycle_value(board uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_l nextphase_board.board_lifecycle; v_d nextphase_board.deleted_board_ids;
BEGIN
  SELECT * INTO v_d FROM nextphase_board.deleted_board_ids x WHERE x.board_id=lifecycle_value.board;
  IF FOUND THEN RETURN jsonb_build_object('boardId',lifecycle_value.board,'workspaceId',v_d.workspace_id,'state','deleted','cycle',NULL,'generation',v_d.generation,'deletedAt',NULL,'restoreBefore',NULL); END IF;
  SELECT * INTO v_l FROM nextphase_board.board_lifecycle x WHERE x.board_id=lifecycle_value.board;
  IF NOT FOUND THEN
    IF EXISTS(SELECT 1 FROM nextphase_board.boards b WHERE b.id=lifecycle_value.board) THEN RAISE EXCEPTION 'service_unavailable'; END IF;
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('boardId',lifecycle_value.board,'workspaceId',v_l.workspace_id,'state',v_l.state,'cycle',v_l.cycle,'generation',v_l.generation,
    'deletedAt',v_l.deleted_at,'restoreBefore',v_l.restore_before,'operationId',v_l.operation_id,'phase',v_l.phase,'nextAttemptAt',v_l.next_attempt_at);
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.lifecycle_owner(caller uuid, workspace uuid, board uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actual uuid; v_member_role text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM nextphase_board.people p WHERE p.id=lifecycle_owner.caller AND NOT p.disabled) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF lifecycle_owner.board IS NOT NULL THEN
    SELECT l.workspace_id INTO v_actual FROM nextphase_board.board_lifecycle l WHERE l.board_id=lifecycle_owner.board;
    IF v_actual IS NULL THEN SELECT d.workspace_id INTO v_actual FROM nextphase_board.deleted_board_ids d WHERE d.board_id=lifecycle_owner.board; END IF;
    IF v_actual IS NULL THEN
      IF EXISTS(SELECT 1 FROM nextphase_board.boards b WHERE b.id=lifecycle_owner.board) THEN RAISE EXCEPTION 'service_unavailable'; END IF;
      RAISE EXCEPTION 'not_found';
    END IF;
    IF lifecycle_owner.workspace IS NOT NULL AND lifecycle_owner.workspace<>v_actual THEN RAISE EXCEPTION 'not_found'; END IF;
  ELSE v_actual:=lifecycle_owner.workspace;
  END IF;
  SELECT m.role INTO v_member_role FROM nextphase_board.workspace_members m WHERE m.workspace_id=v_actual AND m.person_id=lifecycle_owner.caller;
  IF v_member_role='owner' THEN RETURN v_actual; END IF;
  IF v_member_role IS NOT NULL OR EXISTS(SELECT 1 FROM nextphase_board.board_grants g WHERE g.board_id=lifecycle_owner.board AND g.person_id=lifecycle_owner.caller) THEN RAISE EXCEPTION 'role_too_low'; END IF;
  RAISE EXCEPTION 'not_found';
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.admit_lifecycle(board uuid, caller uuid, workspace uuid, operation text,
  request uuid, expected_cycle bigint, digest text, at_ms bigint, floor_generation bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_w uuid; v_l nextphase_board.board_lifecycle; v_old nextphase_board.board_lifecycle_requests; v_op uuid; v_next_state text; v_g bigint;
BEGIN
  v_w:=nextphase_board.lifecycle_owner(admit_lifecycle.caller,admit_lifecycle.workspace,admit_lifecycle.board);
  PERFORM 1 FROM nextphase_board.workspaces x WHERE x.id=v_w FOR UPDATE;
  PERFORM nextphase_board.lifecycle_owner(admit_lifecycle.caller,v_w,admit_lifecycle.board);
  SELECT * INTO v_l FROM nextphase_board.board_lifecycle x WHERE x.board_id=admit_lifecycle.board FOR UPDATE;
  IF EXISTS(SELECT 1 FROM nextphase_board.deleted_board_ids d WHERE d.board_id=admit_lifecycle.board) THEN
    IF admit_lifecycle.operation IN ('move','purge') THEN RETURN nextphase_board.lifecycle_value(admit_lifecycle.board); END IF;
    RAISE EXCEPTION 'trash_expired';
  END IF;
  IF v_l.board_id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF admit_lifecycle.operation NOT IN ('move','restore','purge') OR admit_lifecycle.request IS NULL OR admit_lifecycle.expected_cycle IS NULL OR admit_lifecycle.expected_cycle NOT BETWEEN 0 AND 9007199254740991
    OR admit_lifecycle.digest IS NULL OR admit_lifecycle.digest !~ '^[0-9a-f]{64}$' OR admit_lifecycle.at_ms IS NULL OR admit_lifecycle.at_ms NOT BETWEEN 0 AND 9007196662740991
    OR admit_lifecycle.floor_generation IS NULL OR admit_lifecycle.floor_generation NOT BETWEEN 0 AND 9007199254740990 THEN RAISE EXCEPTION 'bad_request'; END IF;
  SELECT * INTO v_old FROM nextphase_board.board_lifecycle_requests r WHERE r.board_id=admit_lifecycle.board AND r.person_id=admit_lifecycle.caller AND r.request_id=admit_lifecycle.request;
  IF FOUND THEN
    IF v_old.digest<>admit_lifecycle.digest OR v_old.operation<>admit_lifecycle.operation OR v_old.expected_cycle<>admit_lifecycle.expected_cycle THEN RAISE EXCEPTION 'request_id_reused'; END IF;
    IF v_old.accepted_cycle<>v_l.cycle THEN RAISE EXCEPTION 'lifecycle_changed'; END IF;
    RETURN nextphase_board.lifecycle_value(admit_lifecycle.board);
  END IF;
  IF v_l.cycle<>admit_lifecycle.expected_cycle THEN RAISE EXCEPTION 'lifecycle_changed'; END IF;
  IF admit_lifecycle.operation='restore' AND v_l.state='purging' THEN RAISE EXCEPTION 'trash_expired'; END IF;
  IF v_l.state IN ('moving','restoring','purging') THEN RAISE EXCEPTION 'lifecycle_pending'; END IF;
  IF admit_lifecycle.operation='move' THEN
    IF v_l.state<>'active' THEN RAISE EXCEPTION 'lifecycle_changed'; END IF;
    v_next_state:='moving';
  ELSIF admit_lifecycle.operation='restore' THEN
    IF v_l.state<>'trashed' OR admit_lifecycle.at_ms>=v_l.restore_before THEN RAISE EXCEPTION 'trash_expired'; END IF;
    v_next_state:='restoring';
  ELSE
    IF v_l.state<>'trashed' THEN RAISE EXCEPTION 'lifecycle_changed'; END IF;
    v_next_state:='purging';
  END IF;
  v_op:=gen_random_uuid();
  SELECT greatest(v_l.generation,admit_lifecycle.floor_generation,b.document_generation,coalesce(d.generation,0))+1 INTO v_g
    FROM nextphase_board.boards b LEFT JOIN nextphase_board.mention_delivery d ON d.board_id=b.id WHERE b.id=admit_lifecycle.board FOR UPDATE OF b;
  IF v_g IS NULL OR v_g>9007199254740991 THEN RAISE EXCEPTION 'service_unavailable'; END IF;
  UPDATE nextphase_board.board_lifecycle x SET state=v_next_state,generation=v_g,operation_id=v_op,phase='admitted',next_attempt_at=admit_lifecycle.at_ms,
    cycle=v_l.cycle+CASE WHEN admit_lifecycle.operation='move' THEN 1 ELSE 0 END,
    deleted_at=CASE WHEN admit_lifecycle.operation='move' THEN admit_lifecycle.at_ms WHEN admit_lifecycle.operation='purge' THEN NULL ELSE v_l.deleted_at END,
    restore_before=CASE WHEN admit_lifecycle.operation='move' THEN admit_lifecycle.at_ms+2592000000 WHEN admit_lifecycle.operation='purge' THEN NULL ELSE v_l.restore_before END WHERE x.board_id=admit_lifecycle.board;
  IF admit_lifecycle.operation='purge' THEN UPDATE nextphase_board.board_lifecycle_requests r SET result='{}' WHERE r.board_id=admit_lifecycle.board; END IF;
  INSERT INTO nextphase_board.board_lifecycle_requests VALUES(admit_lifecycle.board,admit_lifecycle.caller,admit_lifecycle.request,v_op,admit_lifecycle.operation,admit_lifecycle.expected_cycle,
    v_l.cycle+CASE WHEN admit_lifecycle.operation='move' THEN 1 ELSE 0 END,admit_lifecycle.digest,'{}');
  RETURN nextphase_board.lifecycle_value(admit_lifecycle.board);
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.lifecycle_step(board uuid, operation uuid, generation bigint, before_phase text, after_phase text, at_ms bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_l nextphase_board.board_lifecycle; v_w uuid; v_result jsonb;
BEGIN
  SELECT x.workspace_id INTO v_w FROM nextphase_board.board_lifecycle x WHERE x.board_id=lifecycle_step.board;
  PERFORM 1 FROM nextphase_board.workspaces x WHERE x.id=v_w FOR UPDATE;
  SELECT * INTO v_l FROM nextphase_board.board_lifecycle x WHERE x.board_id=lifecycle_step.board FOR UPDATE;
  IF v_l.board_id IS NULL THEN RETURN nextphase_board.lifecycle_value(lifecycle_step.board); END IF;
  IF v_l.operation_id IS DISTINCT FROM lifecycle_step.operation OR v_l.generation<>lifecycle_step.generation THEN RAISE EXCEPTION 'lifecycle_pending'; END IF;
  IF v_l.phase<>lifecycle_step.before_phase THEN RETURN nextphase_board.lifecycle_value(lifecycle_step.board); END IF;
  IF NOT ((v_l.state='moving' AND (lifecycle_step.before_phase,lifecycle_step.after_phase) IN (('admitted','room_fenced'),('room_fenced','delivery_cleared'),('delivery_cleared','idle'))) OR
    (v_l.state='restoring' AND (lifecycle_step.before_phase,lifecycle_step.after_phase) IN (('admitted','room_fenced'),('room_fenced','access_ready'),('access_ready','idle'))) OR
    (v_l.state='purging' AND (lifecycle_step.before_phase,lifecycle_step.after_phase) IN (('admitted','room_removed'),('room_removed','sql_removed'),('sql_removed','deleted')))) THEN RAISE EXCEPTION 'bad_request'; END IF;
  IF lifecycle_step.after_phase='deleted' THEN
    INSERT INTO nextphase_board.deleted_board_ids VALUES(lifecycle_step.board,v_w,lifecycle_step.generation) ON CONFLICT(board_id) DO UPDATE SET generation=greatest(nextphase_board.deleted_board_ids.generation,excluded.generation);
    DELETE FROM nextphase_board.board_lifecycle_requests r WHERE r.board_id=lifecycle_step.board;
    DELETE FROM nextphase_board.board_lifecycle x WHERE x.board_id=lifecycle_step.board;
  ELSE
    UPDATE nextphase_board.board_lifecycle x SET phase=lifecycle_step.after_phase,
      state=CASE WHEN lifecycle_step.after_phase='idle' THEN CASE WHEN v_l.state='moving' THEN 'trashed' ELSE 'active' END ELSE v_l.state END,
      operation_id=CASE WHEN lifecycle_step.after_phase='idle' THEN NULL ELSE lifecycle_step.operation END,
      next_attempt_at=CASE WHEN lifecycle_step.after_phase='idle' THEN NULL ELSE lifecycle_step.at_ms END,
      deleted_at=CASE WHEN lifecycle_step.after_phase='idle' AND v_l.state='restoring' THEN NULL ELSE v_l.deleted_at END,
      restore_before=CASE WHEN lifecycle_step.after_phase='idle' AND v_l.state='restoring' THEN NULL ELSE v_l.restore_before END WHERE x.board_id=lifecycle_step.board;
    v_result:=nextphase_board.lifecycle_value(lifecycle_step.board);
    UPDATE nextphase_board.board_lifecycle_requests r SET result=(v_result-'operationId'-'phase'-'nextAttemptAt')::text WHERE r.board_id=lifecycle_step.board AND r.accepted_cycle=v_l.cycle;
  END IF;
  RETURN nextphase_board.lifecycle_value(lifecycle_step.board);
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.lifecycle_delivery_clear(board uuid, operation uuid, generation bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_w uuid;
BEGIN
  SELECT x.workspace_id INTO v_w FROM nextphase_board.board_lifecycle x WHERE x.board_id=lifecycle_delivery_clear.board;
  PERFORM 1 FROM nextphase_board.workspaces x WHERE x.id=v_w FOR UPDATE;
  PERFORM 1 FROM nextphase_board.board_lifecycle l WHERE l.board_id=lifecycle_delivery_clear.board AND l.operation_id=lifecycle_delivery_clear.operation AND l.generation=lifecycle_delivery_clear.generation AND l.state IN ('moving','restoring') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lifecycle_pending'; END IF;
  PERFORM 1 FROM nextphase_board.boards b WHERE b.id=lifecycle_delivery_clear.board FOR UPDATE;
  DELETE FROM nextphase_board.mention_inbox n WHERE n.board_id=lifecycle_delivery_clear.board;
  DELETE FROM nextphase_board.mention_leases n WHERE n.board_id=lifecycle_delivery_clear.board;
  INSERT INTO nextphase_board.mention_delivery VALUES(lifecycle_delivery_clear.board,lifecycle_delivery_clear.generation,-1) ON CONFLICT(board_id)
    DO UPDATE SET generation=greatest(nextphase_board.mention_delivery.generation,excluded.generation);
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.lifecycle_cleanup(board uuid, operation uuid, generation bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_w uuid;
BEGIN
  SELECT x.workspace_id INTO v_w FROM nextphase_board.board_lifecycle x WHERE x.board_id=lifecycle_cleanup.board;
  PERFORM 1 FROM nextphase_board.workspaces x WHERE x.id=v_w FOR UPDATE;
  PERFORM 1 FROM nextphase_board.board_lifecycle l WHERE l.board_id=lifecycle_cleanup.board AND l.operation_id=lifecycle_cleanup.operation AND l.generation=lifecycle_cleanup.generation AND l.state='purging' AND l.phase='room_removed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lifecycle_pending'; END IF;
  DELETE FROM nextphase_board.mention_inbox x WHERE x.board_id=lifecycle_cleanup.board;
  DELETE FROM nextphase_board.mention_leases x WHERE x.board_id=lifecycle_cleanup.board;
  DELETE FROM nextphase_board.mention_delivery x WHERE x.board_id=lifecycle_cleanup.board;
  DELETE FROM nextphase_board.access_deliveries x WHERE x.board_id=lifecycle_cleanup.board;
  DELETE FROM nextphase_board.access_changes x WHERE x.board_id=lifecycle_cleanup.board;
  DELETE FROM nextphase_board.board_opens x WHERE x.board_id=lifecycle_cleanup.board;
  DELETE FROM nextphase_board.invitations x WHERE x.board_id=lifecycle_cleanup.board;
  DELETE FROM nextphase_board.board_grants x WHERE x.board_id=lifecycle_cleanup.board;
  DELETE FROM nextphase_board.boards x WHERE x.id=lifecycle_cleanup.board;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.lifecycle_due(at_ms bigint) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(page.board_id ORDER BY page.due,page.board_id),'[]') FROM (
    SELECT l.board_id,coalesce(l.next_attempt_at,l.restore_before) due FROM nextphase_board.board_lifecycle l
    WHERE (l.state IN ('moving','restoring','purging') AND l.next_attempt_at<=lifecycle_due.at_ms) OR (l.state='trashed' AND l.restore_before<=lifecycle_due.at_ms)
    UNION ALL SELECT d.board_id,0 due FROM nextphase_board.deleted_board_ids d JOIN nextphase_board.boards b ON b.id=d.board_id
    ORDER BY due,board_id LIMIT 50) page
$$;
CREATE OR REPLACE FUNCTION nextphase_board.lifecycle_tick(board uuid, at_ms bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_l nextphase_board.board_lifecycle; v_w uuid; v_g bigint;
BEGIN
  SELECT x.workspace_id INTO v_w FROM nextphase_board.board_lifecycle x WHERE x.board_id=lifecycle_tick.board;
  PERFORM 1 FROM nextphase_board.workspaces x WHERE x.id=v_w FOR UPDATE;
  SELECT * INTO v_l FROM nextphase_board.board_lifecycle x WHERE x.board_id=lifecycle_tick.board FOR UPDATE;
  IF v_l.state IN ('moving','trashed') AND v_l.restore_before<=lifecycle_tick.at_ms THEN
    SELECT greatest(v_l.generation,b.document_generation,coalesce(d.generation,0))+1 INTO v_g FROM nextphase_board.boards b LEFT JOIN nextphase_board.mention_delivery d ON d.board_id=b.id WHERE b.id=lifecycle_tick.board FOR UPDATE OF b;
    UPDATE nextphase_board.board_lifecycle x SET state='purging',phase='admitted',generation=v_g,operation_id=gen_random_uuid(),deleted_at=NULL,restore_before=NULL,next_attempt_at=lifecycle_tick.at_ms WHERE x.board_id=lifecycle_tick.board;
    UPDATE nextphase_board.board_lifecycle_requests r SET result='{}' WHERE r.board_id=lifecycle_tick.board;
  END IF;
  RETURN nextphase_board.lifecycle_value(lifecycle_tick.board);
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.lifecycle_retry(board uuid, operation uuid, at_ms bigint) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE nextphase_board.board_lifecycle l SET next_attempt_at=lifecycle_retry.at_ms+60000 WHERE l.board_id=lifecycle_retry.board AND l.operation_id=lifecycle_retry.operation AND l.state IN ('moving','restoring','purging')
$$;
CREATE OR REPLACE FUNCTION nextphase_board.trash_page(caller uuid, workspace uuid, pending boolean DEFAULT NULL, deleted_at bigint DEFAULT NULL, after_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM nextphase_board.lifecycle_owner(trash_page.caller,trash_page.workspace,NULL);
  SELECT coalesce(jsonb_agg(page.row ORDER BY page.group_key,page.time_key DESC,page.board_id),'[]') INTO v_result FROM (
    SELECT l.board_id,CASE WHEN l.state='trashed' THEN 1 ELSE 0 END group_key,CASE WHEN l.state='trashed' THEN l.deleted_at ELSE 0 END time_key,
      jsonb_build_object('boardId',l.board_id,'workspaceId',l.workspace_id,'state',l.state,'cycle',l.cycle,'generation',l.generation) ||
      CASE WHEN l.state='trashed' THEN jsonb_build_object('title',b.title,'deletedAt',l.deleted_at,'restoreBefore',l.restore_before) ELSE '{}'::jsonb END row
    FROM nextphase_board.board_lifecycle l LEFT JOIN nextphase_board.boards b ON b.id=l.board_id
    WHERE l.workspace_id=trash_page.workspace AND l.state<>'active' AND NOT EXISTS(SELECT 1 FROM nextphase_board.deleted_board_ids d WHERE d.board_id=l.board_id)
      AND (trash_page.after_id IS NULL OR (CASE WHEN l.state='trashed' THEN 1 ELSE 0 END,-CASE WHEN l.state='trashed' THEN l.deleted_at ELSE 0 END,l.board_id)>
        (CASE WHEN trash_page.pending THEN 0 ELSE 1 END,-coalesce(trash_page.deleted_at,0),trash_page.after_id))
    ORDER BY group_key,time_key DESC,l.board_id LIMIT 51) page;
  RETURN v_result;
END $$;
CREATE OR REPLACE FUNCTION nextphase_board.revoke_unavailable_board_grant(board uuid, person uuid, caller uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_w uuid; v_state text;
BEGIN
  v_w:=nextphase_board.lifecycle_owner(revoke_unavailable_board_grant.caller,NULL,revoke_unavailable_board_grant.board);
  PERFORM 1 FROM nextphase_board.workspaces x WHERE x.id=v_w FOR UPDATE;
  PERFORM nextphase_board.lifecycle_owner(revoke_unavailable_board_grant.caller,v_w,revoke_unavailable_board_grant.board);
  SELECT l.state INTO v_state FROM nextphase_board.board_lifecycle l WHERE l.board_id=revoke_unavailable_board_grant.board AND l.workspace_id=v_w FOR UPDATE;
  IF v_state IS NULL OR v_state NOT IN ('active','moving','trashed','restoring') OR EXISTS(SELECT 1 FROM nextphase_board.deleted_board_ids d WHERE d.board_id=revoke_unavailable_board_grant.board) THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM nextphase_board.remove_grant(revoke_unavailable_board_grant.board,revoke_unavailable_board_grant.person);
END $$;

CREATE OR REPLACE FUNCTION nextphase_board.lifecycle_recovery_request(board uuid, operation uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_jsonb(r) FROM nextphase_board.board_lifecycle_requests r WHERE r.board_id=lifecycle_recovery_request.board AND r.operation_id=lifecycle_recovery_request.operation
$$;
-- Only an operator preserving the current independent ledger may invoke this during SQL recovery.
-- Listeners and schedulers stay stopped until every independently preserved row is reapplied.
CREATE OR REPLACE FUNCTION nextphase_board.reapply_lifecycle(record jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_a jsonb; v_r jsonb; v_board uuid; v_w uuid; v_g bigint;
BEGIN
  IF octet_length(reapply_lifecycle.record::text)>=131072 OR jsonb_typeof(reapply_lifecycle.record)<>'object' THEN RAISE EXCEPTION 'bad_request'; END IF;
  v_a:=coalesce(reapply_lifecycle.record->'authority',reapply_lifecycle.record);v_board:=(v_a->>'boardId')::uuid;v_w:=(v_a->>'workspaceId')::uuid;v_g:=(v_a->>'generation')::bigint;
  PERFORM 1 FROM nextphase_board.workspaces x WHERE x.id=v_w FOR UPDATE;
  IF NOT FOUND OR v_board IS NULL OR v_g IS NULL OR v_g NOT BETWEEN 0 AND 9007199254740991 THEN RAISE EXCEPTION 'bad_request'; END IF;
  IF NOT reapply_lifecycle.record ? 'authority' THEN
    -- Reapply denial first. Normal phase work then drains any recovered room and SQL rows.
    INSERT INTO nextphase_board.deleted_board_ids VALUES(v_board,v_w,v_g) ON CONFLICT(board_id) DO UPDATE SET generation=greatest(nextphase_board.deleted_board_ids.generation,excluded.generation);
    DELETE FROM nextphase_board.board_lifecycle_requests x WHERE x.board_id=v_board;
    DELETE FROM nextphase_board.board_lifecycle x WHERE x.board_id=v_board;
    RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM nextphase_board.deleted_board_ids d WHERE d.board_id=v_board) THEN RETURN; END IF;
  INSERT INTO nextphase_board.board_lifecycle VALUES(v_board,v_w,v_a->>'state',(v_a->>'cycle')::bigint,v_g,(v_a->>'deletedAt')::bigint,(v_a->>'restoreBefore')::bigint,(v_a->>'operationId')::uuid,v_a->>'phase',(v_a->>'nextAttemptAt')::bigint)
    ON CONFLICT(board_id) DO UPDATE SET state=excluded.state,cycle=excluded.cycle,generation=excluded.generation,deleted_at=excluded.deleted_at,restore_before=excluded.restore_before,operation_id=excluded.operation_id,phase=excluded.phase,next_attempt_at=excluded.next_attempt_at
    WHERE nextphase_board.board_lifecycle.generation<=excluded.generation;
  v_r:=reapply_lifecycle.record->'request';
  IF v_r IS NOT NULL AND v_r<>'null'::jsonb THEN
    INSERT INTO nextphase_board.board_lifecycle_requests SELECT * FROM jsonb_populate_record(NULL::nextphase_board.board_lifecycle_requests,v_r) ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION nextphase_board.cleanup_recovered_deleted(board uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_w uuid;
BEGIN
  SELECT d.workspace_id INTO v_w FROM nextphase_board.deleted_board_ids d WHERE d.board_id=cleanup_recovered_deleted.board;
  PERFORM 1 FROM nextphase_board.workspaces x WHERE x.id=v_w FOR UPDATE;
  IF v_w IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  DELETE FROM nextphase_board.mention_inbox x WHERE x.board_id=cleanup_recovered_deleted.board;
  DELETE FROM nextphase_board.mention_leases x WHERE x.board_id=cleanup_recovered_deleted.board;
  DELETE FROM nextphase_board.mention_delivery x WHERE x.board_id=cleanup_recovered_deleted.board;
  DELETE FROM nextphase_board.access_deliveries x WHERE x.board_id=cleanup_recovered_deleted.board;
  DELETE FROM nextphase_board.access_changes x WHERE x.board_id=cleanup_recovered_deleted.board;
  DELETE FROM nextphase_board.board_opens x WHERE x.board_id=cleanup_recovered_deleted.board;
  DELETE FROM nextphase_board.invitations x WHERE x.board_id=cleanup_recovered_deleted.board;
  DELETE FROM nextphase_board.board_grants x WHERE x.board_id=cleanup_recovered_deleted.board;
  DELETE FROM nextphase_board.boards x WHERE x.id=cleanup_recovered_deleted.board;
END $$;

CREATE OR REPLACE FUNCTION nextphase_board.lifecycle_request_status(board uuid, caller uuid, request uuid, digest text, operation text, expected_cycle bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_r nextphase_board.board_lifecycle_requests; v_current jsonb;
BEGIN
  PERFORM nextphase_board.lifecycle_owner(lifecycle_request_status.caller,NULL,lifecycle_request_status.board);
  SELECT * INTO v_r FROM nextphase_board.board_lifecycle_requests x WHERE x.board_id=lifecycle_request_status.board AND x.person_id=lifecycle_request_status.caller AND x.request_id=lifecycle_request_status.request;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_r.digest<>lifecycle_request_status.digest OR v_r.operation<>lifecycle_request_status.operation OR v_r.expected_cycle<>lifecycle_request_status.expected_cycle THEN RAISE EXCEPTION 'request_id_reused'; END IF;
  v_current:=nextphase_board.lifecycle_value(lifecycle_request_status.board);
  IF v_r.accepted_cycle<>(v_current->>'cycle')::bigint THEN RAISE EXCEPTION 'lifecycle_changed'; END IF;
  RETURN v_current;
END $$;

CREATE OR REPLACE FUNCTION nextphase_board.lifecycle_raise(board uuid, operation uuid, minimum bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_w uuid; v_l nextphase_board.board_lifecycle; v_g bigint;
BEGIN
  SELECT x.workspace_id INTO v_w FROM nextphase_board.board_lifecycle x WHERE x.board_id=lifecycle_raise.board;
  PERFORM 1 FROM nextphase_board.workspaces x WHERE x.id=v_w FOR UPDATE;
  SELECT * INTO v_l FROM nextphase_board.board_lifecycle x WHERE x.board_id=lifecycle_raise.board AND x.operation_id=lifecycle_raise.operation FOR UPDATE;
  IF v_l.board_id IS NULL OR v_l.state NOT IN ('moving','restoring','purging') THEN RAISE EXCEPTION 'lifecycle_pending'; END IF;
  PERFORM 1 FROM nextphase_board.boards b WHERE b.id=lifecycle_raise.board FOR UPDATE;
  SELECT greatest(v_l.generation,lifecycle_raise.minimum,coalesce((SELECT b.document_generation FROM nextphase_board.boards b WHERE b.id=lifecycle_raise.board),0),coalesce((SELECT d.generation FROM nextphase_board.mention_delivery d WHERE d.board_id=lifecycle_raise.board),0))+1 INTO v_g;
  IF lifecycle_raise.minimum IS NULL OR lifecycle_raise.minimum<0 OR v_g IS NULL OR v_g>9007199254740991 THEN RAISE EXCEPTION 'bad_request'; END IF;
  UPDATE nextphase_board.board_lifecycle x SET generation=v_g WHERE x.board_id=lifecycle_raise.board;
  RETURN nextphase_board.lifecycle_value(lifecycle_raise.board);
END $$;

-- A workspace library is independent of board documents and room storage.
CREATE TABLE IF NOT EXISTS nextphase_board.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES nextphase_board.workspaces(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120 AND name !~ '^\s*$'),
  description text NOT NULL CHECK (char_length(description) <= 300),
  objects jsonb NOT NULL CHECK (jsonb_typeof(objects) = 'array'),
  object_count integer NOT NULL CHECK (object_count BETWEEN 1 AND 250 AND object_count = jsonb_array_length(objects)),
  content_bytes integer NOT NULL CHECK (content_bytes BETWEEN 1 AND 262144),
  creator_id uuid NOT NULL REFERENCES nextphase_board.people(id), creator_label text NOT NULL,
  source_board_id uuid NOT NULL, source_title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS templates_updated ON nextphase_board.templates(workspace_id, updated_at DESC, id);
ALTER TABLE nextphase_board.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE nextphase_board.templates ADD COLUMN IF NOT EXISTS store uuid;

CREATE OR REPLACE FUNCTION nextphase_board.list_templates(person uuid, workspace uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text; v_template nextphase_board.templates;
BEGIN
  SELECT m.role INTO v_role FROM nextphase_board.workspace_members m
    JOIN nextphase_board.people p ON p.id=m.person_id AND NOT p.disabled
    WHERE m.workspace_id=list_templates.workspace AND m.person_id=list_templates.person;
  IF v_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_role='guest' THEN RAISE EXCEPTION 'role_too_low' USING DETAIL='viewer'; END IF;
  RETURN jsonb_build_object('canSave',v_role IN ('owner','editor'),'templates',coalesce((
    SELECT jsonb_agg((to_jsonb(t) - 'store') || jsonb_build_object('can_manage',v_role='owner' OR (v_role='editor' AND t.creator_id=list_templates.person))
      ORDER BY t.updated_at DESC,t.id) FROM nextphase_board.templates t WHERE t.workspace_id=list_templates.workspace
  ),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION nextphase_board.get_template(person uuid, workspace uuid, template uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text; v_template nextphase_board.templates;
BEGIN
  SELECT m.role INTO v_role FROM nextphase_board.workspace_members m
    JOIN nextphase_board.people p ON p.id=m.person_id AND NOT p.disabled
    WHERE m.workspace_id=get_template.workspace AND m.person_id=get_template.person;
  IF v_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_role='guest' THEN RAISE EXCEPTION 'role_too_low' USING DETAIL='viewer'; END IF;
  SELECT * INTO v_template FROM nextphase_board.templates t
    WHERE t.workspace_id=get_template.workspace AND t.id=get_template.template;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN to_jsonb(v_template) || jsonb_build_object('can_manage',v_role='owner' OR (v_role='editor' AND v_template.creator_id=get_template.person));
END $$;

DROP FUNCTION IF EXISTS nextphase_board.save_template(uuid, uuid, uuid, text, text, jsonb, integer, integer, text, text);
CREATE OR REPLACE FUNCTION nextphase_board.save_template(person uuid, workspace uuid, board uuid, name text, description text, objects jsonb, object_count integer, content_bytes integer, creator_label text, source_title text, store uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text; v_template nextphase_board.templates; v_title text; v_board_role text;
BEGIN
  PERFORM 1 FROM nextphase_board.workspaces w WHERE w.id=save_template.workspace FOR UPDATE;
  SELECT m.role INTO v_role FROM nextphase_board.workspace_members m
    JOIN nextphase_board.people p ON p.id=m.person_id AND NOT p.disabled
    WHERE m.workspace_id=save_template.workspace AND m.person_id=save_template.person;
  IF v_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_role='guest' THEN RAISE EXCEPTION 'role_too_low' USING DETAIL='viewer'; END IF;
  IF v_role NOT IN ('owner','editor') THEN RAISE EXCEPTION 'role_too_low' USING DETAIL='editor'; END IF;
  SELECT b.title INTO v_title FROM nextphase_board.boards b
    WHERE b.id=save_template.board AND b.workspace_id=save_template.workspace AND nextphase_board.board_active(b.id);
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  v_board_role:=nextphase_board.board_role(save_template.person,save_template.board);
  IF v_board_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_board_role NOT IN ('owner','editor') THEN RAISE EXCEPTION 'role_too_low' USING DETAIL='editor'; END IF;
  IF (SELECT count(*) FROM nextphase_board.templates t WHERE t.workspace_id=save_template.workspace)>=25 THEN
    RAISE EXCEPTION 'template_limit';
  END IF;
  INSERT INTO nextphase_board.templates(workspace_id,name,description,objects,object_count,content_bytes,creator_id,creator_label,source_board_id,source_title,store)
    VALUES(save_template.workspace,save_template.name,save_template.description,save_template.objects,save_template.object_count,
      save_template.content_bytes,save_template.person,save_template.creator_label,save_template.board,v_title,save_template.store) RETURNING * INTO v_template;
  RETURN to_jsonb(v_template) || jsonb_build_object('can_manage',v_role='owner' OR (v_role='editor' AND v_template.creator_id=save_template.person));
END $$;

CREATE OR REPLACE FUNCTION nextphase_board.update_template_details(person uuid, workspace uuid, template uuid, name text, description text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text; v_template nextphase_board.templates;
BEGIN
  SELECT m.role INTO v_role FROM nextphase_board.workspace_members m
    JOIN nextphase_board.people p ON p.id=m.person_id AND NOT p.disabled
    WHERE m.workspace_id=update_template_details.workspace AND m.person_id=update_template_details.person;
  IF v_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_role='guest' THEN RAISE EXCEPTION 'role_too_low' USING DETAIL='viewer'; END IF;
  SELECT * INTO v_template FROM nextphase_board.templates t
    WHERE t.workspace_id=update_template_details.workspace AND t.id=update_template_details.template FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_role<>'owner' AND NOT (v_role='editor' AND v_template.creator_id=update_template_details.person) THEN
    RAISE EXCEPTION 'role_too_low' USING DETAIL='owner';
  END IF;
  UPDATE nextphase_board.templates t SET name=update_template_details.name,description=update_template_details.description,updated_at=clock_timestamp()
    WHERE t.id=v_template.id RETURNING * INTO v_template;
  RETURN to_jsonb(v_template) || jsonb_build_object('can_manage',v_role='owner' OR (v_role='editor' AND v_template.creator_id=update_template_details.person));
END $$;

DROP FUNCTION IF EXISTS nextphase_board.replace_template(uuid, uuid, uuid, uuid, jsonb, integer, integer, text);
CREATE OR REPLACE FUNCTION nextphase_board.replace_template(person uuid, workspace uuid, template uuid, board uuid, objects jsonb, object_count integer, content_bytes integer, source_title text, store uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text; v_template nextphase_board.templates; v_title text; v_board_role text; v_previous uuid;
BEGIN
  SELECT m.role INTO v_role FROM nextphase_board.workspace_members m
    JOIN nextphase_board.people p ON p.id=m.person_id AND NOT p.disabled
    WHERE m.workspace_id=replace_template.workspace AND m.person_id=replace_template.person;
  IF v_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_role='guest' THEN RAISE EXCEPTION 'role_too_low' USING DETAIL='viewer'; END IF;
  SELECT * INTO v_template FROM nextphase_board.templates t
    WHERE t.workspace_id=replace_template.workspace AND t.id=replace_template.template FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_role<>'owner' AND NOT (v_role='editor' AND v_template.creator_id=replace_template.person) THEN
    RAISE EXCEPTION 'role_too_low' USING DETAIL='owner';
  END IF;
  SELECT b.title INTO v_title FROM nextphase_board.boards b
    WHERE b.id=replace_template.board AND b.workspace_id=replace_template.workspace AND nextphase_board.board_active(b.id);
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  v_board_role:=nextphase_board.board_role(replace_template.person,replace_template.board);
  IF v_board_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_board_role NOT IN ('owner','editor') THEN RAISE EXCEPTION 'role_too_low' USING DETAIL='editor'; END IF;
  v_previous:=v_template.store;
  UPDATE nextphase_board.templates t SET objects=replace_template.objects,object_count=replace_template.object_count,
    content_bytes=replace_template.content_bytes,source_board_id=replace_template.board,source_title=v_title,updated_at=clock_timestamp(),store=replace_template.store
    WHERE t.id=v_template.id RETURNING * INTO v_template;
  RETURN to_jsonb(v_template) || jsonb_build_object('can_manage',v_role='owner' OR (v_role='editor' AND v_template.creator_id=replace_template.person),'previousStore',v_previous);
END $$;

CREATE OR REPLACE FUNCTION nextphase_board.delete_template(person uuid, workspace uuid, template uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text; v_template nextphase_board.templates;
BEGIN
  SELECT m.role INTO v_role FROM nextphase_board.workspace_members m
    JOIN nextphase_board.people p ON p.id=m.person_id AND NOT p.disabled
    WHERE m.workspace_id=delete_template.workspace AND m.person_id=delete_template.person;
  IF v_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_role='guest' THEN RAISE EXCEPTION 'role_too_low' USING DETAIL='viewer'; END IF;
  SELECT * INTO v_template FROM nextphase_board.templates t
    WHERE t.workspace_id=delete_template.workspace AND t.id=delete_template.template FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_role<>'owner' AND NOT (v_role='editor' AND v_template.creator_id=delete_template.person) THEN
    RAISE EXCEPTION 'role_too_low' USING DETAIL='owner';
  END IF;
  DELETE FROM nextphase_board.templates t WHERE t.id=v_template.id;
  RETURN jsonb_build_object('store',v_template.store);
END $$;

-- Repeated runs replace policies without widening privileges.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['people','workspaces','workspace_members','boards','board_opens','board_grants','invitations','access_changes','access_log_floor','access_deliveries'] LOOP
    EXECUTE format('ALTER TABLE nextphase_board.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS read_own ON nextphase_board.%I', t);
  END LOOP;
END $$;
CREATE POLICY read_own ON nextphase_board.board_opens FOR SELECT TO authenticated USING (nextphase_board.is_owner(NULL) AND person_id = auth.uid() AND nextphase_board.board_role(auth.uid(),board_id) IS NOT NULL);
CREATE POLICY read_own ON nextphase_board.boards FOR SELECT TO authenticated
  USING (nextphase_board.board_role(auth.uid(),id) IS NOT NULL);
CREATE POLICY read_own ON nextphase_board.workspaces FOR SELECT TO authenticated USING (
  nextphase_board.is_owner(NULL) AND EXISTS(SELECT 1 FROM nextphase_board.workspace_members m WHERE m.workspace_id = id AND m.person_id = auth.uid()));
CREATE POLICY read_own ON nextphase_board.workspace_members FOR SELECT TO authenticated
  USING (nextphase_board.is_owner(NULL) AND (person_id = auth.uid() OR nextphase_board.is_owner(workspace_id)));
CREATE POLICY read_own ON nextphase_board.board_grants FOR SELECT TO authenticated USING (nextphase_board.is_owner(NULL) AND nextphase_board.board_role(auth.uid(),board_id) IS NOT NULL AND (
  person_id = auth.uid() OR EXISTS(SELECT 1 FROM nextphase_board.boards b WHERE b.id = board_id AND nextphase_board.is_owner(b.workspace_id))));
CREATE POLICY read_own ON nextphase_board.invitations FOR SELECT TO authenticated USING (nextphase_board.is_owner(workspace_id) AND (board_id IS NULL OR nextphase_board.board_role(auth.uid(),board_id) IS NOT NULL));
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

REVOKE ALL ON nextphase_board.board_lifecycle, nextphase_board.board_lifecycle_requests, nextphase_board.deleted_board_ids FROM PUBLIC, anon, authenticated;

REVOKE ALL ON nextphase_board.templates FROM PUBLIC, anon, authenticated;
