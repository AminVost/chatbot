CREATE TABLE IF NOT EXISTS nava_security_owner (singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), user_id uuid NOT NULL UNIQUE);
INSERT INTO nava_security_owner(singleton,user_id) SELECT true,id FROM neon_auth."user" WHERE lower(email)='aminvost@gmail.com' AND "emailVerified"=true AND NOT COALESCE(banned,false) ON CONFLICT(singleton) DO NOTHING;
CREATE TABLE IF NOT EXISTS nava_security_rate (scope text NOT NULL, subject text NOT NULL, bucket bigint NOT NULL, hits integer NOT NULL CHECK(hits>0), PRIMARY KEY(scope,subject));
