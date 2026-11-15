package auth

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestReservedUsername(t *testing.T) {
	for _, u := range []string{
		"admin", "ADMIN", "Admin_xx", "adm1n", "4dmin", "a.d.m.i.n", "administrateur", "administrator",
		"babi", "Babi2", "b4b1", "babilife", "BabiLife2", "babi_life", "babi.life", "b4bi_l1fe", "lifeinbabi",
		"support", "supp0rt_team", "equipe", "equ1pe", "team", "team_1", "moderateur", "moderator", "modo", "m0d0", "modo2",
		"staff", "5taff", "officiel", "official", "koffi_officiel", "root", "system", "systeme", "claude", "Claude1",
		"help", "aide", "contact", "security", "securite", "testeur", "t3st3ur",
	} {
		if !ReservedUsername(u) {
			t.Errorf("%q should be reserved", u)
		}
	}
	for _, u := range []string{"koffi", "awa_225", "modou", "Modou.Diallo", "babiqueen", "teamkoffi", "claudine", "jean.claude", "badminton", "rootsman", "aidara", "helpine_k", "systo", "abibatou"} {
		if ReservedUsername(u) {
			t.Errorf("%q should be free", u)
		}
	}
}

// The availability check and the sign-up refuse a reserved name (and names without a letter) before touching the database.
func TestReservedUsernameEndpoints(t *testing.T) {
	h := &Handler{}
	rec := httptest.NewRecorder()
	h.UsernameAvailable(rec, httptest.NewRequest("GET", "/api/v1/auth/username?u=Adm1n_xx", nil))
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"available":false`) || !strings.Contains(rec.Body.String(), `"reserved":true`) {
		t.Errorf("availability of a reserved name: %d %s", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	body := `{"firstName":"Awa","lastName":"Koné","username":"babilife2","email":"awa@example.com","password":"motdepasse"}`
	h.Register(rec, httptest.NewRequest("POST", "/api/v1/auth/register", strings.NewReader(body)))
	if rec.Code != 409 {
		t.Errorf("sign-up with a reserved name: %d %s", rec.Code, rec.Body.String())
	}
	for _, names := range [][2]string{{"   ", "Koné"}, {"Awa", "  "}, {"...", "Koné"}, {"Awa", "123"}} {
		rec = httptest.NewRecorder()
		body := `{"firstName":"` + names[0] + `","lastName":"` + names[1] + `","username":"awa_k","email":"awa@example.com","password":"motdepasse"}`
		h.Register(rec, httptest.NewRequest("POST", "/api/v1/auth/register", strings.NewReader(body)))
		if rec.Code != 422 {
			t.Errorf("sign-up with names %q: %d %s", names, rec.Code, rec.Body.String())
		}
	}
}
