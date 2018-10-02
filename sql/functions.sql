
-- opprett eller oppdater bruker

CREATE OR REPLACE FUNCTION find_or_create_user(in_oauth_id text, in_first_name text, in_last_name text, in_email text, in_photo_url text, in_oauth_provider text)
    RETURNS UUID
    LANGUAGE 'plpgsql'

AS $BODY$
DECLARE
     -- uid skal symbolisere ID feltet i Users tabellen
     uid UUID;
BEGIN
    -- sjekk om bruker finnes, og hent ut bruker id
    SELECT id INTO uid
    FROM Users
    WHERE oauth_id = in_oauth_id;

    -- finnes bruker ikke?
    IF NOT FOUND THEN
        -- registrer bruker
        uid := gen_random_uuid();
        INSERT INTO Users(id, oauth_id, first_name,last_name,email,photo_url, oauth_provider)
            VALUES(uid, in_oauth_id, in_first_name, in_last_name, in_email, in_photo_url, in_oauth_provider);
        -- inviter bruker til test prosjekt
        INSERT INTO ProjectInvitation(project_id, user_id, permission)
            VALUES('a7acfbe0-70d5-4453-a8a3-477e6f9870fb', uid, 4);
    ELSE
        --oppdater bruker
        UPDATE Users
        SET first_name = in_first_name, last_name = in_last_name, email = in_email, photo_url = in_photo_url
        WHERE id = uid;
    END IF;
    -- returner bruker ID
    RETURN uid;
END;
$BODY$;

-- opprett et prosjekt

CREATE OR REPLACE FUNCTION create_project(name text, uid UUID)
    RETURNS UUID
    LANGUAGE 'plpgsql'
AS $BODY$

DECLARE
    project_id UUID;
    root_id UUID;
    test_obj UUID;
BEGIN
    project_id := gen_random_uuid();
    root_id := gen_random_uuid();
    test_obj := gen_random_uuid();

    -- opprett prosjekt
    INSERT INTO Project(id,name) VALUES(project_id, name);
    -- opprett rot mappe til prosjekt
    INSERT INTO Object(id, name, project_id, is_directory) VALUES(root_id, 'root', project_id, true);
    -- opprett en test fil
    INSERT INTO Object(id, name, project_id, parent_id) VALUES (test_obj, 'velkommen.txt', project_id, root_id);
    -- sett inn litt data i test fila
    INSERT INTO ObjectIteration(object_id, value) VALUES(test_obj, 'Det er bare til å prøve seg frem!');
    -- gi bruker tilgang til prosjekt
    INSERT INTO ProjectPermission(user_id, project_id, permission) VALUES(uid, project_id, 6);
    -- returner prosjekt_id
    RETURN project_id;
END;
$BODY$;


/*
 opprett et objekt
    - Dersom bruker har tilgang til prosjektet
    - Dersom bruker har tilgang til å legge til objekter (mapper eller filer)
    - Dersom objektet blir lagt til en mappe (ikke fil)
    - Dersom navnet ikke finnes fra før i mappe
*/
DROP FUNCTION create_object(in_user_id UUID, in_parent_id UUID, name text, is_directory BOOLEAN);
-- opprett en
CREATE OR REPLACE FUNCTION create_object(in_user_id UUID, in_parent_id UUID, in_name text, is_directory BOOLEAN, is_blob BOOLEAN,  OUT o_object_id UUID, OUT o_project_id UUID, value TEXT DEFAULT NULL)
    LANGUAGE 'plpgsql'
AS $BODY$
    DECLARE
        object_id UUID;
        permission INTEGER;
        in_project_id UUID;
        parent_is_directory BOOLEAN;
    BEGIN


        -- Hent ut prosjekt ID
        SELECT O.project_id, O.is_directory INTO in_project_id, parent_is_directory -- wow dette går ann!
        FROM Object AS O
        WHERE O.id = in_parent_id;

        IF FOUND THEN
            -- sjekk om objekt er en mappe (duh)
            IF parent_is_directory IS TRUE THEN

                -- Sjekk om bruker har lov til dette
                SELECT P.permission INTO permission
                FROM projectpermission AS P
                WHERE P.project_id = in_project_id
                    AND P.user_id = in_user_id;

                -- tilgang funnet, sjekk om den er høy nok
                IF FOUND  AND ((permission >= 3 AND is_directory IS FALSE) OR (permission >= 4 AND is_directory IS TRUE)) THEN
                    -- Sjekk om navnet finnes fra før av
                    PERFORM name
                    FROM Object AS O
                    WHERE O.parent_id = in_parent_id
                    AND O.deleted IS FALSE
                    AND UPPER(o.name) = UPPER(in_name);

                    IF FOUND THEN
                        RAISE 'NAME_TAKEN';
                    ELSE
                        -- generer objekt_id
                        object_id := gen_random_uuid();
                        -- opprett objekt
                       INSERT INTO Object (id, parent_id, project_id, name, is_directory, is_blob)
                       VALUES(object_id, in_parent_id, in_project_id, in_name, is_directory, is_blob);
                        -- Er dokument verdi satt og opplastning ikker er blob, sett inn verdi
                        IF is_blob IS FALSE AND value IS NOT NULL AND is_directory IS FALSE THEN
                            -- Sett inn dokument verdi i ObjectIteration
                            INSERT INTO ObjectIteration(object_id, value)
                            VALUES (object_id, value);
                        END IF;
                        -- Objektet er en opplastet fil, ObjectBLOB...
                        -- value vil da være referanse til ObjectBLOB
                        IF is_blob IS TRUE AND value IS NOT NULL THEN
                            INSERT INTO ObjectBLOB(object_id, file_ref)
                            VALUES(object_id, value);
                        END IF;
                        -- returner object_id
                       o_project_id := in_project_id;
                       o_object_id := object_id;
                    END IF;
                ELSE
                    RAISE 'NO_ACCESS';
                END IF;
            ELSE
                RAISE 'NOT_DIRECTORY';
            END IF;
        ELSE
            RAISE 'INVALID_PARENT';
        END IF;
    END;
$BODY$;

DROP FUNCTION delete_object(in_user_id UUID, in_object_id UUID);
-- fjern
CREATE OR REPLACE FUNCTION delete_object(in_user_id UUID, in_object_id UUID)
    RETURNS UUID
    LANGUAGE 'plpgsql' AS $BODY$

DECLARE
    in_project_id UUID;
    permission INTEGER;
BEGIN
    -- hent ut prosjekt id
    SELECT project_id INTO in_project_id
    FROM Object
    WHERE id = in_object_id
    AND parent_id IS NOT NULL; -- dersom parent_id er null, så er det rot mappe. Den vil vi ikke slette

    IF FOUND THEN

        -- fant prosjekt, finn ut om bruker har tilgang
        SELECT P.permission INTO permission
        FROM ProjectPermission AS P
        WHERE P.project_id = in_project_id
            AND P.user_id = in_user_id;

        -- Bruker trenger tilgangsnivå 4 eller mer for å slette objekter

        IF FOUND AND permission >= 4 THEN
            -- Sjekk om det er registrert 'barn' (children) på dette objektet, aktuelt dersom objektet er en mappe
            PERFORM id
            FROM Object
            WHERE parent_id = in_object_id
            AND deleted IS FALSE;

            IF NOT FOUND THEN
                -- Legg objekt i papirkurv ved å sette deleted til true
                UPDATE Object SET deleted = TRUE
                WHERE id = in_object_id;
                RETURN in_project_id;
            ELSE
                RAISE 'HAS_CHILDREN';
            END IF;
        ELSE
            RAISE 'NO_ACCESS';
        END IF;

    ELSE
        RAISE 'INVALID_OBJECT';
    END IF;

END;
$BODY$;

-- Flytt objekt(er)
CREATE OR REPLACE FUNCTION move_object(in_user_id UUID, in_object_id UUID, in_new_parent_id UUID)
    RETURNS UUID
    LANGUAGE 'plpgsql' AS $BODY$
DECLARE
    object_name TEXT;
    in_project_id UUID;
    permission INTEGER;

BEGIN
    -- Hent ut prosjekt id og navn fra objekt, og er flyttbart dersom det ikke er rot og ikke er slettet.
    SELECT project_id, name INTO in_project_id, object_name
    FROM Object
    WHERE id = in_object_id
    AND parent_id IS NOT NULL
    AND deleted is FALSE;


    IF FOUND THEN
        -- Sjekk om den nye foreldre objektet faktisk tilhører samme prosjekt (glemte nesten denne)
        -- Sjekk også at den er en mappe og ikke en fil.
        PERFORM project_id
        FROM Object
        WHERE id = in_new_parent_id
        AND project_id = in_project_id
        AND is_directory IS TRUE;

        IF FOUND THEN
            -- OBjektet og den nye foreldre objektet er gyldig, sjekk om bruker har adgang
            SELECT P.permission INTO permission
            FROM ProjectPermission AS P
            WHERE P.project_id = in_project_id
                AND P.user_id = in_user_id;
            IF FOUND AND permission >= 4 THEN
                -- Sjekk om navnet allerede er brukt hvor objektet skal flyttes
                PERFORM name
                FROM Object
                WHERE UPPER(name) = UPPER(object_name)
                AND deleted IS FALSE
                AND parent_id = in_new_parent_id;


                IF NOT FOUND THEN

                    UPDATE Object SET parent_id = in_new_parent_id
                    WHERE id = in_object_id;
                    RETURN in_project_id;
                ELSE
                    RAISE 'NAME_DUPLCATE';
                END IF;
            ELSE
                RAISE 'NO_ACCESS';
            END IF;
        ELSE
            RAISE 'PARENT_INVALID';
        END IF;
    ELSE
        RAISE 'UNMOVABLE_OBJECT';
    END IF;

END;
$BODY$;

DROP FUNCTION rename_object(in_user_id UUID, in_object_id UUID, new_name TEXT);
-- rename object
CREATE OR REPLACE FUNCTION rename_object(in_user_id UUID, in_object_id UUID, new_name TEXT, OUT o_project_id UUID, OUT o_new_name TEXT)
    LANGUAGE 'plpgsql' AS $BODY$
DECLARE
    permission INTEGER;
    in_project_id UUID;
    in_parent_id UUID;
BEGIN
    -- hent ut prosjektdata
    SELECT project_id, parent_id INTO in_project_id, in_parent_id
    FROM Object
    WHERE id = in_object_id
    AND parent_id IS NOT NULL; -- dersom parent_id er null, så er det rot mappe. Den vil vi ikke bytte navn på

    IF FOUND THEN

        -- fant prosjekt, finn ut om bruker har tilgang
        SELECT P.permission INTO permission
        FROM ProjectPermission AS P
        WHERE P.project_id = in_project_id
            AND P.user_id = in_user_id;

        -- Sjekk om bruker har tilgang
        IF FOUND AND permission >= 4 THEN
            -- Har tilgang, sjekk om det nye navnet finnes fra før
            PERFORM name
            FROM Object AS O
            WHERE O.parent_id = in_parent_id
            AND O.deleted IS FALSE
            AND UPPER(o.name) = UPPER(new_name);

            IF NOT FOUND THEN
                -- oppdater navn
                UPDATE Object SET name = new_name
                WHERE id = in_object_id;
                o_new_name := new_name;
                o_project_id := in_project_id;
            ELSE
                RAISE 'NAME_TAKEN';
            END IF;
        ELSE
            RAISE 'NO_ACCESS';
        END IF;
    ELSE
        RAISE 'INVALID_OBJECT';
    END IF;
END;
$BODY$;

CREATE OR REPLACE FUNCTION get_blob_ref(in_user_id UUID, in_object_id UUID)
    RETURNS TEXT
    LANGUAGE 'plpgsql' AS $BODY$
DECLARE
    permission INTEGER;
    in_project_id UUID;
    in_file_ref TEXT;
BEGIN
    -- Sjekk om objectBLOB finnes, hent ut prosjekt ID og file_ref (hashet tilf ilen)
    SELECT project_id, file_ref INTO in_project_id, in_file_ref
    FROM Object AS O
    JOIN ObjectBLOB AS OB
      ON O.id = OB.object_id
    WHERE O.deleted IS FALSE
      AND O.id = in_object_id;

    IF FOUND THEN
        -- Sjekk om bruker har tilgang til prosjektet
        SELECT P.permission INTO permission
        FROM ProjectPermission AS P
        WHERE P.project_id = in_project_id
            AND P.user_id = in_user_id;

        IF FOUND AND permission >= 1 THEN
            -- Bruker har tilgang, returner in_file_ref
            RETURN in_file_ref;
        ELSE
            RAISE 'NO_ACCESS';
        END IF;

    ELSE
        RAISE 'NOT_FOUND';
    END IF;
END;
$BODY$;

CREATE OR REPLACE FUNCTION accept_invite(in_user_id UUID, in_project_id UUID)
    RETURNS UUID
    LANGUAGE 'plpgsql' AS $BODY$
DECLARE
    in_permission INTEGER;
BEGIN
    -- Finn først om invitasjon finnes
    SELECT permission INTO in_permission
    FROM ProjectInvitation
    WHERE project_id = in_project_id
        AND user_id = in_user_id;
    IF FOUND THEN
        -- Invitasjon finnes, legg til prosjekt til bruker
        INSERT INTO ProjectPermission(project_id, user_id, permission)
        VALUES(in_project_id, in_user_id, in_permission);
        -- Slett invitasjon
        DELETE FROM ProjectInvitation
        WHERE project_id = in_project_id
            AND user_id = in_user_id;
        -- returner prosjekt ID
        RETURN in_project_id;
    ELSE
        RAISE 'INVITATION_INVALID';
    END IF;
END;
$BODY$;






