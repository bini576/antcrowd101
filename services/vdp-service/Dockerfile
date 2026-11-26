FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod=mod -o vdp-service ./

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/vdp-service /app/vdp-service
COPY --from=builder /app/migrations /app/migrations
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8082/health || exit 1

ENTRYPOINT ["/app/vdp-service"]
