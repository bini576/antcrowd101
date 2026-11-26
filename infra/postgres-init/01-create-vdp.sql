SELECT 'CREATE DATABASE vdp OWNER antcrowd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vdp')\gexec
