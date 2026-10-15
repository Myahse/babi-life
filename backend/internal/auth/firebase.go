package auth

import (
	"context"
	"errors"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

const firebaseCertsURL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"

// FirebaseVerifier checks ID tokens from Firebase Auth signed in with Google.
// Audience and issuer are the Firebase project id.
type FirebaseVerifier struct {
	projectID string
	keys      *keySet
}

func NewFirebaseVerifier(projectID string) *FirebaseVerifier {
	return &FirebaseVerifier{projectID: projectID, keys: newKeySet(firebaseCertsURL)}
}

type firebaseClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Firebase      struct {
		SignInProvider string `json:"sign_in_provider"`
	} `json:"firebase"`
	jwt.RegisteredClaims
}

func (v *FirebaseVerifier) Verify(ctx context.Context, idToken string) (GoogleIdentity, error) {
	var claims firebaseClaims
	_, err := jwt.ParseWithClaims(idToken, &claims, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		return v.keys.key(ctx, kid)
	},
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithAudience(v.projectID),
		jwt.WithIssuer("https://securetoken.google.com/"+v.projectID),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return GoogleIdentity{}, err
	}
	if claims.Firebase.SignInProvider != "google.com" {
		return GoogleIdentity{}, errors.New("not a google sign-in")
	}
	if !claims.EmailVerified || claims.Email == "" {
		return GoogleIdentity{}, errors.New("email not verified")
	}
	first, last, _ := strings.Cut(strings.TrimSpace(claims.Name), " ")
	return GoogleIdentity{
		Sub: claims.Subject, Email: strings.ToLower(claims.Email),
		Name: claims.Name, FirstName: first, LastName: last, Picture: claims.Picture,
	}, nil
}
