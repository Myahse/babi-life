package waitlist

import "testing"

func TestContact(t *testing.T) {
	ok := map[string][2]string{
		"Awa.Kone@Mail.com":   {"awa.kone@mail.com", "email"},
		"07 07 07 07 07":      {"+2250707070707", "phone"},
		"+225 01 02 03 04 05": {"+2250102030405", "phone"},
		"00225 0102030405":    {"+2250102030405", "phone"},
		"+33 6 12 34 56 78":   {"+33612345678", "phone"},
	}
	for in, want := range ok {
		c, k, err := Contact(in)
		if err != nil || c != want[0] || k != want[1] {
			t.Errorf("%q: got %q %q %v, want %v", in, c, k, err, want)
		}
	}
	for _, bad := range []string{"", "awa@", "12345", "Awa <awa@mail.com>", "bonjour"} {
		if _, _, err := Contact(bad); err == nil {
			t.Errorf("%q should be refused", bad)
		}
	}
}

func TestAllow(t *testing.T) {
	h := &Handler{}
	for i := 0; i < 20; i++ {
		if !h.allow("1.2.3.4") {
			t.Fatalf("sign-up %d refused", i+1)
		}
	}
	if h.allow("1.2.3.4") {
		t.Fatal("the 21st sign-up in an hour should wait")
	}
	if !h.allow("5.6.7.8") {
		t.Fatal("another network is not limited")
	}
}
