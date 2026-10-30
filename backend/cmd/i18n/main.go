// Command i18n keeps the server's English catalogue (internal/i18n/en.json:
// { "the French": "the English" }): the French the server says to the player
// (an action's label, a place, a happening, a journal line, a refusal, an NPC's
// line) is found in its Go string literals, and said in English to a player who
// plays in English (internal/i18n: the X-Lang header, translated on the way out).
//
//	go run ./cmd/i18n              the counts
//	go run ./cmd/i18n -check       fails if a string has no English (or brings a verb the French hasn't)
//	go run ./cmd/i18n -todo F      the strings without English, numbered, in F (id TAB file TAB French)
//	go run ./cmd/i18n -merge F -from T   F's lines (id|English) for the -todo T, into the catalogue
//	go run ./cmd/i18n -prune       drops the entries no literal holds any more
//
// A literal with fmt verbs (%s, %d…) is a pattern: its English keeps the verbs,
// in order, or numbered (%[2]s) when English puts them the other way round.
// "=" keeps the French (a name, a brand).
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/myahse/babi-life/backend/internal/i18n"
	"github.com/myahse/babi-life/backend/internal/i18n/extract"
)

var (
	check = flag.Bool("check", false, "fail if a string has no English")
	todo  = flag.String("todo", "", "write the strings without English to this file")
	merge = flag.String("merge", "", "merge these translations (id|English) into the catalogue")
	from  = flag.String("from", "", "the -todo file the -merge answers")
	prune = flag.Bool("prune", false, "drop the entries no literal holds")
)

func main() {
	flag.Parse()
	root := "internal"
	lits, err := extract.Literals(root)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	catPath := filepath.Join(root, "i18n", "en.json")
	cat := map[string]string{}
	if b, err := os.ReadFile(catPath); err == nil {
		_ = json.Unmarshal(b, &cat)
	}
	keys := make([]string, 0, len(lits))
	for k := range lits {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var missing, bad []string
	for _, k := range keys {
		e, ok := cat[k]
		if !ok || e == "" {
			missing = append(missing, k)
		} else if e != "=" && !i18n.SameVerbs(k, e) {
			bad = append(bad, k)
		}
	}
	unused := 0
	for k := range cat {
		if lits[k] == nil {
			unused++
		}
	}
	switch {
	case *todo != "":
		var b strings.Builder
		for i, k := range missing {
			files := make([]string, 0)
			for f := range lits[k].Files {
				files = append(files, f)
			}
			sort.Strings(files)
			fmt.Fprintf(&b, "%d\t%s\t%s\n", i, files[0], strings.ReplaceAll(k, "\n", `\n`))
		}
		must(os.WriteFile(*todo, []byte(b.String()), 0o644))
		js, _ := json.Marshal(missing)
		must(os.WriteFile(*todo+".json", js, 0o644))
		fmt.Printf("%d strings to translate in %s\n", len(missing), *todo)
	case *merge != "":
		var list []string
		js, err := os.ReadFile(*from + ".json")
		must(err)
		must(json.Unmarshal(js, &list))
		fh, err := os.Open(*merge)
		must(err)
		sc := bufio.NewScanner(fh)
		sc.Buffer(make([]byte, 1<<20), 1<<20)
		n := 0
		for sc.Scan() {
			id, en, ok := strings.Cut(sc.Text(), "|")
			i, err := strconv.Atoi(id)
			if !ok || err != nil || i < 0 || i >= len(list) {
				continue
			}
			en = strings.ReplaceAll(en, `\n`, "\n")
			if en == list[i] {
				en = "="
			}
			cat[list[i]] = en
			n++
		}
		fh.Close()
		write(catPath, cat)
		fmt.Printf("%d merged\n", n)
	case *prune:
		for k := range cat {
			if lits[k] == nil {
				delete(cat, k)
			}
		}
		write(catPath, cat)
	}
	fmt.Printf("i18n (server): %d strings, %d in English, %d still in French only, %d with other verbs, %d unused\n", len(keys), len(keys)-len(missing), len(missing), len(bad), unused)
	if *check {
		for _, k := range bad {
			fmt.Printf("  verbs differ: %q → %q\n", k, cat[k])
		}
		if len(missing)+len(bad) > 0 {
			os.Exit(1)
		}
	}
}

func write(path string, cat map[string]string) {
	// One entry a line, sorted, the quotes and « < » as they are.
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "")
	must(enc.Encode(cat))
	must(os.WriteFile(path, b.Bytes(), 0o644))
}

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
}
