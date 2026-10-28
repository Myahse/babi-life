// Package mail sends the game's few e-mails (a password reset link), each
// with a plain-text and an HTML part (templates.go). Two ways out:
//   - Brevo's HTTP API (BREVO_API_KEY): over HTTPS, so it works where a host
//     blocks the SMTP ports (Render's free plan does);
//   - any SMTP server (SMTP_HOST, SMTP_PORT 587, SMTP_USER, SMTP_PASS).
//
// MAIL_FROM is the sender either way (« Babi Life <noreply@lifeinbabi.com> »);
// with Brevo, its address must be a sender or domain verified there.
package mail

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/mail"
	"net/smtp"
	"os"
	"strings"
	"time"
)

// Message: one e-mail; Text is what clients without HTML show.
type Message struct {
	To, Name, Subject, Text, HTML string
	// Tag: what kind of e-mail (Brevo's statistics sort by it).
	Tag string
	// Unsubscribe: a news e-mail's « ne plus recevoir » link (the List-Unsubscribe header too).
	Unsubscribe string
}

// Sender sends a Message (Brevo, SMTP, or the log in development).
type Sender interface {
	Send(ctx context.Context, m Message) error
}

// FromEnv: Brevo when BREVO_API_KEY is set, else SMTP when SMTP_HOST is; nil when neither (or no MAIL_FROM).
func FromEnv() Sender {
	from := os.Getenv("MAIL_FROM")
	if from == "" {
		return nil
	}
	if key := os.Getenv("BREVO_API_KEY"); key != "" {
		return &Brevo{Key: key, From: from}
	}
	m := &SMTP{Host: os.Getenv("SMTP_HOST"), Port: os.Getenv("SMTP_PORT"), User: os.Getenv("SMTP_USER"), Pass: os.Getenv("SMTP_PASS"), From: from}
	if m.Host == "" {
		return nil
	}
	if m.Port == "" {
		m.Port = "587"
	}
	return m
}

func checkTo(to string) error {
	if strings.ContainsAny(to, "\r\n") || !strings.Contains(to, "@") {
		return fmt.Errorf("bad address")
	}
	return nil
}

// Brevo: the transactional e-mail API (https://api.brevo.com/v3/smtp/email).
type Brevo struct {
	Key, From string
	// API: Brevo's address (tests point it elsewhere).
	API    string
	Client *http.Client
}

func (b *Brevo) Send(ctx context.Context, m Message) error {
	if err := checkTo(m.To); err != nil {
		return err
	}
	from, err := mail.ParseAddress(b.From)
	if err != nil {
		return fmt.Errorf("MAIL_FROM: %w", err)
	}
	to := map[string]string{"email": m.To}
	if m.Name != "" {
		to["name"] = m.Name
	}
	body := map[string]any{
		"sender":      map[string]string{"name": from.Name, "email": from.Address},
		"to":          []any{to},
		"subject":     m.Subject,
		"htmlContent": m.HTML,
		"textContent": m.Text,
	}
	if m.Tag != "" {
		body["tags"] = []string{m.Tag}
	}
	if m.Unsubscribe != "" {
		body["headers"] = map[string]string{"List-Unsubscribe": "<" + m.Unsubscribe + ">"}
	}
	raw, _ := json.Marshal(body)
	api := b.API
	if api == "" {
		api = "https://api.brevo.com/v3"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, api+"/smtp/email", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("api-key", b.Key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	c := b.Client
	if c == nil {
		c = &http.Client{Timeout: 15 * time.Second}
	}
	res, err := c.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("brevo: %s: %s", res.Status, bytes.TrimSpace(msg))
	}
	return nil
}

// SMTP: any provider that speaks SMTP (smtp.SendMail upgrades to TLS when the server offers it).
type SMTP struct {
	Host, Port, User, Pass, From string
}

func (s *SMTP) Send(_ context.Context, m Message) error {
	if err := checkTo(m.To); err != nil {
		return err
	}
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	boundary := "babi-" + hex.EncodeToString(b)
	head := []string{
		"From: " + s.From,
		"To: " + m.To,
		"Subject: " + mime.QEncoding.Encode("utf-8", m.Subject),
		"Date: " + time.Now().Format(time.RFC1123Z),
		"MIME-Version: 1.0",
	}
	var msg string
	if m.HTML == "" {
		msg = strings.Join(append(head, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", m.Text), "\r\n")
	} else {
		msg = strings.Join(append(head,
			"Content-Type: multipart/alternative; boundary="+boundary, "",
			"--"+boundary, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", m.Text,
			"--"+boundary, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", m.HTML,
			"--"+boundary+"--", ""), "\r\n")
	}
	var a smtp.Auth
	if s.User != "" {
		a = smtp.PlainAuth("", s.User, s.Pass, s.Host)
	}
	from := s.From
	if addr, err := mail.ParseAddress(s.From); err == nil {
		from = addr.Address
	}
	return smtp.SendMail(s.Host+":"+s.Port, a, from, []string{m.To}, []byte(msg))
}

// Log: in development (DEV_LOGIN), the e-mails are written to the log instead of sent.
type Log struct{}

func (Log) Send(_ context.Context, m Message) error {
	log.Printf("mail (dev, not sent) to %s: %s\n%s", m.To, m.Subject, m.Text)
	return nil
}
