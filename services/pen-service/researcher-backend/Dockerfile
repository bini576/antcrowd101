FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /bin/pen-researcher ./main.go

FROM alpine:3.20
RUN adduser -D appuser
USER appuser
COPY --from=build /bin/pen-researcher /bin/pen-researcher
EXPOSE 8087
ENTRYPOINT ["/bin/pen-researcher"]
