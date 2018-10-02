CREATE EXTENSION pgcrypto;

SELECT gen_random_uuid();

DROP TABLE Users;
DROP TABLE Project;
DROP TABLE ProjectPermission;
DROP TABLE ProjectMessage;
DROP TABLE ProjectInvitation;
DROP TABLE Object;
DROP TABLE ObjectBLOB;
DROP TABLE ObjectIteration;

CREATE TABLE Users (
  id UUID DEFAULT gen_random_uuid(),
  oauth_id CHAR(32) UNIQUE,
  oauth_provider CHAR(32),
  email CHAR(100),
  first_name CHAR(100),
  last_name CHAR(100),
  photo_url CHAR(150),
  time_created TIMESTAMP DEFAULT NOW(),
  CONSTRAINT Users_PK PRIMARY KEY(id)
);



CREATE TABLE Project(
  id UUID,
  name TEXT NOT NULL,
  description TEXT,
  time_created TIMESTAMP DEFAULT NOW(),
  CONSTRAINT Project_PK PRIMARY KEY(id)
);


CREATE TABLE ProjectPermission(
  project_id UUID,
  user_id UUID,
  permission INT,
  CONSTRAINT permission_check CHECK(permission >= 1 AND permission <= 6),
  CONSTRAINT ProjectPermission_PK PRIMARY KEY (project_id, user_id),
  CONSTRAINT ProjectPermission_User_FK FOREIGN KEY (user_id)
    REFERENCES Users(id),
  CONSTRAINT ProjectPermission_Project_FK FOREIGN KEY (project_id)
    REFERENCES Project(id)
);

CREATE TABLE ProjectMessage (
  project_id UUID NOT NULL,
  user_id UUID,
  value TEXT NOT NULL,
  time_created TIMESTAMP DEFAULT NOW(),
  CONSTRAINT ProjectMessage_PK PRIMARY KEY(user_id, time_created), -- dikuter primærnøkkel, jeg tror en UUID er overkill her
  CONSTRAINT ProjectMessage_Project_FK FOREIGN KEY (project_id)
    REFERENCES Project(id),
  CONSTRAINT ProjectMessage_Users_FK FOREIGN KEY (user_id)
    REFERENCES Users(id)
);

CREATE TABLE ProjectInvitation (
  project_id UUID,
  user_id UUID,
  permission INTEGER,
  CONSTRAINT ProjectInvitation_PK PRIMARY KEY (project_id, user_id),
  CONSTRAINT ProjectInvitation_Project FOREIGN KEY (project_id)
    REFERENCES Project(id),
  CONSTRAINT ProjectInvitation_User FOREIGN KEY (user_id)
    REFERENCES Users(id)
);


CREATE TABLE Object(
  id UUID DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_directory BOOLEAN DEFAULT FALSE,
  is_blob BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,
  parent_id UUID,
  project_id UUID NOT NULL,
  time_created TIMESTAMP DEFAULT NOW(),
  CONSTRAINT Object_PK PRIMARY KEY (id),
  CONSTRAINT Object_Project_FK FOREIGN KEY (project_id)
    REFERENCES Project(id)
);

-- tabell for opplastede objekter, Object og ObjectBLOB er et 'en til en forhold'
CREATE TABLE ObjectBLOB (
  object_id UUID,
  file_ref TEXT NOT NULL,
  CONSTRAINT ObjectBLOB_PK PRIMARY KEY (object_id),
  CONSTRAINT ObjectBLOB_Object_FK FOREIGN KEY (object_id)
    REFERENCES Object(id)
);

CREATE TABLE ObjectIteration (
  id SERIAL,
  object_id UUID,
  time TIMESTAMP  DEFAULT NOW(),
  value TEXT,
  CONSTRAINT ObjectIteration_PK PRIMARY KEY (object_id, time),
  CONSTRAINT ObjectIteration_Object_FK FOREIGN KEY (object_id)
    REFERENCES Object(id)
);



BEGIN;

SELECT create_object('329e4780-69fe-481d-b980-92424a5caf58', 'd6b215bb-dcbb-4fb8-840d-3502fd5113c6', 'test', TRUE);
SELECT delete_object('329e4780-69fe-481d-b980-92424a5caf58','d6b215bb-dcbb-4fb8-840d-3502fd5113c6');
SELECT rename_object('329e4780-69fe-481d-b980-92424a5caf58', 'f03da4ad-73e1-45ba-bee4-1d16de484ee7', 'lol');

ROLLBACK;
END;

SELECT *
FROM Object
WHERE project_id='af6704d9-b9c7-4891-8cdd-bf1b42b18812'
AND deleted IS FALSE;

SELECT * FROM Users;
SELECT * FROM Project;
SELECT * FROM Object WHERE deleted IS FALSE;
SELECT * FROM ObjectBLOB;
SELECT * FROM ObjectIteration;
SELECT * FROM ProjectPermission;
SELECT * FROM ProjectMessage;
SELECT * FROM ProjectInvitation;

INSERT INTO ProjectPermission(project_id,user_id,permission) VALUES('a3e6fec3-19be-487a-95ff-83644d9f5da2', 'c525e705-f50a-4490-b883-d2896eb2b82a',5);


 SELECT move_object('329e4780-69fe-481d-b980-92424a5caf58', '932a3b25-effa-4813-a9c7-763ef40a0b7c', '2a0e4eb4-7603-4c41-8588-bb1996816f04');


INSERT INTO ObjectIteration(object_id, value) VALUES ('0608b25e-fcfd-44d8-9dae-6813e60dbcde', 'Test');

-- Litt jalla løsning, men trenger bare å kjøre en spørring på denne måten. Og det skal fungere bra
SELECT id, project_id,  MAX(time) AS time
FROM Object AS O
LEFT JOIN ObjectIteration AS OI
  ON O.id = OI.object_id
WHERE id = '0608b25e-fcfd-44d8-9dae-6813e60dbcde'
GROUP BY id, project_id;

INSERT INTO ObjectIteration(object_id, value) VALUES('0608b25e-fcfd-44d8-9dae-6813e60dbcde','yrdy');


SELECT id, value
FROM ObjectIteration
WHERE object_id = '0608b25e-fcfd-44d8-9dae-6813e60dbcde'
AND time = '2017-09-18 11:04:43.332233';



SELECT id, name, project_id, to_char(MAX(id), 'MM-DD-YYYY HH24:MI:SS') AS time
FROM Object AS O, ObjectIteration AS OI
WHERE O.id =OI.object_id
GROUP BY id, name, project_id;


SELECT O.id, name, project_id, MAX(OI.id) AS latest
FROM Object AS O
LEFT JOIN ObjectIteration AS OI
  ON O.id =OI.object_id
WHERE O.id = '0608b25e-fcfd-44d8-9dae-6813e60dbcde'
GROUP BY O.id, name, project_id;

set timezone='UTC';
SELECT  current_setting('TIMEZONE');



SELECT project_id, user_id, permission, P.name
FROM ProjectInvitation AS PI, Project AS P
WHERE PI.project_id = P.id
AND user_id='51824db9-8744-4552-bf58-0ee8bbda4228';


SELECT project_id, file_ref
FROM Object AS O
JOIN ObjectBLOB AS OB
  ON O.id = OB.object_id
WHERE O.deleted IS FALSE
  AND O.id = '052a9299-9756-4100-a100-e5e1bbbe243f';