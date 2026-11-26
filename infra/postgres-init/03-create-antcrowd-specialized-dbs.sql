SELECT 'CREATE DATABASE challenge_db OWNER antcrowd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'challenge_db')\gexec

SELECT 'CREATE DATABASE ai_redteam_db OWNER antcrowd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ai_redteam_db')\gexec

SELECT 'CREATE DATABASE bug_bounty_db OWNER antcrowd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bug_bounty_db')\gexec
