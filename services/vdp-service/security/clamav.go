package security

import (
	"bufio"
	"context"
	"encoding/binary"
	"errors"
	"net"
	"strconv"
	"strings"
	"time"
)

type ClamAV struct {
	host    string
	port    int
	timeout time.Duration
}

func NewClamAV(host string, port int, timeout time.Duration) *ClamAV {
	if host == "" || port == 0 {
		return nil
	}
	return &ClamAV{host: host, port: port, timeout: timeout}
}

func (c *ClamAV) Scan(ctx context.Context, data []byte) (bool, string, error) {
	if c == nil {
		return true, "", nil
	}
	addr := net.JoinHostPort(c.host, strconv.Itoa(portOrDefault(c.port)))
	dialer := &net.Dialer{Timeout: c.timeout}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return false, "", err
	}
	defer conn.Close()

	if err := conn.SetDeadline(time.Now().Add(c.timeout)); err != nil {
		return false, "", err
	}

	if _, err := conn.Write([]byte("zINSTREAM\x00")); err != nil {
		return false, "", err
	}

	const chunkSize = 1024 * 1024
	for i := 0; i < len(data); i += chunkSize {
		end := i + chunkSize
		if end > len(data) {
			end = len(data)
		}
		chunk := data[i:end]
		var lenBuf [4]byte
		binary.BigEndian.PutUint32(lenBuf[:], uint32(len(chunk)))
		if _, err := conn.Write(lenBuf[:]); err != nil {
			return false, "", err
		}
		if _, err := conn.Write(chunk); err != nil {
			return false, "", err
		}
	}
	var zero [4]byte
	if _, err := conn.Write(zero[:]); err != nil {
		return false, "", err
	}

	reader := bufio.NewReader(conn)
	resp, err := reader.ReadString('\x00')
	if err != nil {
		return false, "", err
	}
	resp = strings.Trim(resp, "\x00\n\r")
	if strings.HasSuffix(resp, "OK") {
		return true, "", nil
	}
	if strings.HasSuffix(resp, "FOUND") {
		parts := strings.Split(resp, ":")
		if len(parts) >= 2 {
			return false, strings.TrimSpace(strings.TrimSuffix(parts[1], "FOUND")), nil
		}
		return false, "malware", nil
	}
	return false, "", errors.New("unexpected clamd response: "+resp)
}

func portOrDefault(p int) int {
	if p == 0 {
		return 3310
	}
	return p
}
