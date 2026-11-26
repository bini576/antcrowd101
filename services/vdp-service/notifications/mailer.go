package notifications

import (
	"fmt"
	"net/smtp"
	"strings"
)

type Mailer struct {
	Host string
	Port string
	User string
	Pass string
	From string
}

func NewMailer(host, port, user, pass, from string) *Mailer {
	return &Mailer{Host: host, Port: port, User: user, Pass: pass, From: from}
}

func (m *Mailer) Enabled() bool {
	return strings.TrimSpace(m.Host) != "" && strings.TrimSpace(m.From) != ""
}

func (m *Mailer) Send(to, subject, body string) error {
	if !m.Enabled() {
		return nil
	}
	addr := fmt.Sprintf("%s:%s", m.Host, m.Port)
	var auth smtp.Auth
	if strings.TrimSpace(m.User) != "" || strings.TrimSpace(m.Pass) != "" {
		auth = smtp.PlainAuth("", m.User, m.Pass, m.Host)
	}

	msg := strings.Builder{}
	msg.WriteString("From: " + m.From + "\r\n")
	msg.WriteString("To: " + to + "\r\n")
	msg.WriteString("Subject: " + subject + "\r\n")
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/plain; charset=utf-8\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(body)

	return smtp.SendMail(addr, auth, m.From, []string{to}, []byte(msg.String()))
}
