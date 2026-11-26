SELECT 'CREATE DATABASE training_service OWNER antcrowd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'training_service')\gexec
