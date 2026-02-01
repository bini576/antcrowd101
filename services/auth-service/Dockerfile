FROM golang:1.25-alpine

WORKDIR /app

# Copy module files first for caching
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the whole package, not just main.go
RUN go build -o service .

# Expose port
EXPOSE 8080

# Run the binary
CMD ["./service"]
