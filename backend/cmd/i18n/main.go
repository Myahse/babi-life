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
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/myahse/babi-life/backend/internal/i18n"
)

var (
	check = flag.Bool("check", false, "fail if a string has no English")
	todo  = flag.String("todo", "", "write the strings without English to this file")
	merge = flag.String("merge", "", "merge these translations (id|English) into the catalogue")
	from  = flag.String("from", "", "the -todo file the -merge answers")
	prune = flag.Bool("prune", false, "drop the entries no literal holds")
)

// Not the player's: the team's admin, the e-mails, the tools.
// Not the player's: the team's admin, the e-mails, the tools, the NPC model's prompt (it answers in the player's language), the places' audit.
var skipDir = regexp.MustCompile(`(^|/)(admin|adminkey|mail|cmd|db|ads|npcchat)(/|$)|(^|/)world/audit\.go$`)

// The places' sources, for the team (« position d'après OpenStreetMap »).
var note = regexp.MustCompile(`OpenStreet|coordonnées|position (approximative|d'après)|d'après OSM`)

// The fields whose text is shown as it is, even a single word (« Manger »).
var textField = map[string]bool{"Label": true, "Title": true, "Name": true, "Text": true, "About": true, "Desc": true, "Description": true, "Hint": true, "Verb": true, "Line": true, "Lines": true, "Message": true, "Msg": true, "Body": true, "Caption": true, "Say": true, "Says": true, "Reply": true, "Detail": true, "Note": true, "Headline": true, "Summary": true, "Tagline": true, "Question": true, "Answer": true, "Choices": true, "Options": true, "Prompt": true, "Tip": true, "Sub": true, "Short": true, "Long": true, "Who": true, "What": true, "Where": true, "Lack": true, "Reason": true, "Outcome": true, "Event": true, "Story": true, "Topic": true, "Job": true, "Place": true}

var (
	frWord  = regexp.MustCompile(`(?i)(^|[\s'’])(le|la|les|un|une|des|du|de|tu|ton|ta|tes|ton|il|elle|on|et|au|aux|est|pour|avec|pas|ne|en|sur|dans|qui|que|ça|ce|cette|chez|plus|son|sa|ses|je|j|mon|ma|mes|nous|vous|ils|leur|par|à|d|l|c|n|s|qu)([\s'’]|$)`)
	accent  = regexp.MustCompile(`[àâäéèêëîïôöùûüçœÀÂÉÈÊÎÔÙÛÇ«»’…]`)
	sqlish  = regexp.MustCompile(`\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WHERE|FROM|JOIN|RETURNING|CONFLICT|VALUES|COALESCE|ORDER BY|GROUP BY|LIMIT)\b`)
	techy   = regexp.MustCompile(`^[a-z0-9_\-.:/#+*%=?&]+$|^https?:|^/|\.(png|jpg|svg|mp3|mp4|json|webp|glb)\b|\{\{|<[a-z]+[ >]`)
	logCall = map[string]bool{"Printf": true, "Println": true, "Print": true, "Fatalf": true, "Fatal": true, "Debug": true, "Info": true, "Warn": true, "Logf": true, "Log": true, "Errorf": false, "Contains": true, "HasPrefix": true, "HasSuffix": true, "Index": true, "Split": true, "Replace": true, "ReplaceAll": true, "TrimPrefix": true, "TrimSuffix": true, "EqualFold": true, "MustCompile": true, "Compile": true, "Getenv": true, "Exec": true, "Query": true, "QueryRow": true, "Header": true, "Set": true, "Get": true, "Add": true, "Del": true, "URLParam": true, "FormValue": true}
)

func prose(s string, loose bool) bool {
	t := strings.TrimSpace(s)
	if t == "" || !strings.ContainsAny(strings.ToLower(t), "abcdefghijklmnopqrstuvwxyzéèàùçê") || sqlish.MatchString(t) || techy.MatchString(t) || note.MatchString(t) {
		return false
	}
	if loose {
		return true
	}
	return accent.MatchString(t) || (strings.Contains(t, " ") && frWord.MatchString(t))
}

type found struct {
	files map[string]bool
}

// literals: every French literal of the player's code, by text.
func literals(root string) (map[string]*found, error) {
	out := map[string]*found{}
	add := func(s, file string) {
		if out[s] == nil {
			out[s] = &found{files: map[string]bool{}}
		}
		out[s].files[file] = true
	}
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(root, path)
		if info.IsDir() {
			if skipDir.MatchString(filepath.ToSlash(rel)) || strings.HasPrefix(info.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") || skipDir.MatchString(filepath.ToSlash(rel)) {
			return nil
		}
		fset := token.NewFileSet()
		f, err := parser.ParseFile(fset, path, nil, 0)
		if err != nil {
			return err
		}
		skip := map[*ast.BasicLit]bool{}
		loose := map[*ast.BasicLit]bool{}
		ast.Inspect(f, func(n ast.Node) bool {
			switch x := n.(type) {
			case *ast.ImportSpec, *ast.Field:
				// Imports, struct tags.
				return false
			case *ast.CallExpr:
				name := ""
				switch fn := x.Fun.(type) {
				case *ast.SelectorExpr:
					name = fn.Sel.Name
				case *ast.Ident:
					name = fn.Name
				}
				if logCall[name] {
					for _, a := range x.Args {
						if b, ok := a.(*ast.BasicLit); ok {
							skip[b] = true
						}
					}
				}
			case *ast.BinaryExpr:
				if x.Op == token.EQL || x.Op == token.NEQ {
					for _, e := range []ast.Expr{x.X, x.Y} {
						if b, ok := e.(*ast.BasicLit); ok {
							skip[b] = true
						}
					}
				}
			case *ast.CaseClause:
				for _, e := range x.List {
					if b, ok := e.(*ast.BasicLit); ok {
						skip[b] = true
					}
				}
			case *ast.IndexExpr:
				if b, ok := x.Index.(*ast.BasicLit); ok {
					skip[b] = true
				}
			case *ast.KeyValueExpr:
				if b, ok := x.Key.(*ast.BasicLit); ok {
					skip[b] = true
				}
				if id, ok := x.Key.(*ast.Ident); ok && textField[id.Name] {
					ast.Inspect(x.Value, func(m ast.Node) bool {
						if b, ok := m.(*ast.BasicLit); ok {
							loose[b] = true
						}
						return true
					})
				}
			}
			return true
		})
		ast.Inspect(f, func(n ast.Node) bool {
			b, ok := n.(*ast.BasicLit)
			if !ok || b.Kind != token.STRING || skip[b] {
				return true
			}
			s, err := strconv.Unquote(b.Value)
			if err != nil || !prose(s, loose[b]) {
				return true
			}
			add(s, filepath.ToSlash(rel))
			return true
		})
		return nil
	})
	return out, err
}

func main() {
	flag.Parse()
	root := "internal"
	lits, err := literals(root)
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
			for f := range lits[k].files {
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
