// Command worldcheck prints the "Look to fix" list of the world data:
// errors first (they break the game), then warnings (facts to verify, data
// to complete). It exits with status 1 when there are errors, for CI.
//
//	go run ./cmd/worldcheck           # everything
//	go run ./cmd/worldcheck -errors   # errors only
package main

import (
	"flag"
	"fmt"
	"os"
	"sort"

	"github.com/myahse/babi-life/backend/internal/world"
)

func main() {
	onlyErrors := flag.Bool("errors", false, "show errors only")
	flag.Parse()

	issues := world.Audit()
	errors := 0
	for _, i := range issues {
		if i.Severity == world.SevError {
			errors++
		} else if *onlyErrors {
			continue
		}
		fmt.Printf("%-7s %-16s %-36s %s\n", i.Severity, i.Code, i.Ref, i.Message)
	}

	fmt.Println()
	summary := world.Summary(issues)
	for _, sev := range []string{world.SevError, world.SevWarning} {
		codes := make([]string, 0, len(summary[sev]))
		for c := range summary[sev] {
			codes = append(codes, c)
		}
		sort.Strings(codes)
		for _, c := range codes {
			fmt.Printf("%s %s: %d\n", sev, c, summary[sev][c])
		}
	}
	if errors > 0 {
		os.Exit(1)
	}
}
