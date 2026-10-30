// Package extract finds the French the server says to the player in its Go
// string literals (cmd/i18n keeps the English catalogue from it; the test
// counts what has no English yet).
package extract

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// Not the player's: the team's admin, the e-mails, the tools.
// Not the player's: the team's admin, the e-mails, the tools, the NPC model's prompt (it answers in the player's language), the places' audit.
var skipDir = regexp.MustCompile(`(^|/)(admin|adminkey|mail|cmd|db|ads|npcchat|i18n)(/|$)|(^|/)world/audit\.go$`)

// The places' sources, for the team (« position d'après OpenStreetMap »).
var note = regexp.MustCompile(`OpenStreet|coordonnées|position (approximative|d'après)|d'après OSM`)

// The fields whose text is shown as it is, even a single word (« Manger »).
var textField = map[string]bool{"Label": true, "Title": true, "Name": true, "Text": true, "About": true, "Desc": true, "Description": true, "Hint": true, "Verb": true, "Line": true, "Lines": true, "Message": true, "Msg": true, "Body": true, "Caption": true, "Say": true, "Says": true, "Reply": true, "Detail": true, "Note": true, "Headline": true, "Summary": true, "Tagline": true, "Question": true, "Answer": true, "Choices": true, "Options": true, "Prompt": true, "Tip": true, "Sub": true, "Short": true, "Long": true, "Who": true, "What": true, "Where": true, "Lack": true, "Reason": true, "Outcome": true, "Event": true, "Story": true, "Topic": true, "Job": true, "Place": true}

var (
	frWord  = regexp.MustCompile(`(?i)(^|[\s'’])(le|la|les|un|une|des|du|de|tu|ton|ta|tes|ton|il|elle|on|et|au|aux|est|pour|avec|pas|ne|en|sur|dans|qui|que|ça|ce|cette|chez|plus|son|sa|ses|je|j|mon|ma|mes|nous|vous|ils|leur|par|à|d|l|c|n|s|qu)([\s'’]|$)`)
	accent  = regexp.MustCompile(`[àâäéèêëîïôöùûüçœÀÂÉÈÊÎÔÙÛÇ«»’…·]`)
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

// Found: where a literal is (the files, relative to the root).
type Found struct {
	Files map[string]bool
}

// Literals: every French literal of the player's code, by text.
func Literals(root string) (map[string]*Found, error) {
	out := map[string]*Found{}
	add := func(s, file string) {
		if out[s] == nil {
			out[s] = &Found{Files: map[string]bool{}}
		}
		out[s].Files[file] = true
	}
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(root, path)
		if info.IsDir() {
			if path != root && (skipDir.MatchString(filepath.ToSlash(rel)) || strings.HasPrefix(info.Name(), ".")) {
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
			case *ast.CompositeLit:
				// A struct written by position, its name first (Level{"Stagiaire", 2500}): the name is shown.
				if len(x.Elts) > 1 {
					if b, ok := x.Elts[0].(*ast.BasicLit); ok && b.Kind == token.STRING {
						if _, kv := x.Elts[1].(*ast.KeyValueExpr); !kv {
							if _, lit := x.Elts[1].(*ast.BasicLit); lit && x.Elts[1].(*ast.BasicLit).Kind != token.STRING {
								loose[b] = true
							}
						}
					}
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
