// Package mail sends the game's few e-mails (a password reset link) over
// SMTP: SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS and MAIL_FROM. Any
// provider that speaks SMTP will do (Brevo, Mailjet, a Gmail app password…).
package mail

import (
	"fmt"
	"log"
	"mime"
	"net/smtp"
	"os"
	"strings"
	"time"
)

type Mailer struct {
	Host, Port, User, Pass, From string
}

// FromEnv: the mailer, or nil when SMTP isn't set up.
func FromEnv() *Mailer {
	m := &Mailer{Host: os.Getenv("SMTP_HOST"), Port: os.Getenv("SMTP_PORT"), User: os.Getenv("SMTP_USER"), Pass: os.Getenv("SMTP_PASS"), From: os.Getenv("MAIL_FROM")}
	if m.Host == "" || m.From == "" {
		return nil
	}
	if m.Port == "" {
		m.Port = "587"
	}
	return m
}

// Send: a plain-text e-mail (smtp.SendMail upgrades to TLS when the server offers it).
func (m *Mailer) Send(to, subject, body string) error {
	if strings.ContainsAny(to, "\r\n") {
		return fmt.Errorf("bad address")
	}
	msg := strings.Join([]string{
		"From: " + m.From,
		"To: " + to,
		"Subject: " + mime.QEncoding.Encode("utf-8", subject),
		"Date: " + time.Now().Format(time.RFC1123Z),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=utf-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		body,
	}, "\r\n")
	var a smtp.Auth
	if m.User != "" {
		a = smtp.PlainAuth("", m.User, m.Pass, m.Host)
	}
	from := m.From
	if i := strings.LastIndex(from, "<"); i >= 0 {
		from = strings.TrimSuffix(from[i+1:], ">")
	}
	return smtp.SendMail(m.Host+":"+m.Port, a, from, []string{to}, []byte(msg))
}

// Log: in development (DEV_LOGIN), the e-mails are written to the log instead of sent.
type Log struct{}

func (Log) Send(to, subject, body string) error {
	log.Printf("mail (dev, not sent) to %s: %s\n%s", to, subject, body)
	return nil
}
