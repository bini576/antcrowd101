# Build stage
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o code-service .

# Runtime stage
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/code-service /app/code-service
COPY migration.sql /app/migration.sql
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["/app/code-service"]
