# AntCrowd Platform — Development Shortcuts

.PHONY: up down logs restart status db

up:
	docker-compose up --build -d

down:
	docker-compose down

logs:
	docker-compose logs -f

restart:
	docker-compose down && docker-compose up --build -d

status:
	docker-compose ps

db:
	docker exec -it antcrowd-postgres psql -U antcrowd
