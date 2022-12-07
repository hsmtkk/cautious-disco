FROM golang:1.19 AS builder
WORKDIR /app
COPY go.mod .
COPY go.sum .
RUN go mod download
COPY webapp/ /app/webapp/
WORKDIR /app/webapp
RUN CGO_ENABLED=0 go build -o webapp

FROM gcr.io/distroless/static-debian11 AS runtime
COPY --from=builder /app/webapp/webapp /usr/local/bin/webapp
ENTRYPOINT ["/usr/local/bin/webapp"]
