FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o trust-center .

FROM alpine:3.19

WORKDIR /app

COPY --from=builder /app/trust-center /app/trust-center
COPY schema.sql /app/schema.sql

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["/app/trust-center"]

