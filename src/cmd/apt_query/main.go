package main

import (
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/common"
	"awalsh128.com/cache-apt-pkgs-action/src/internal/exec"
	"awalsh128.com/cache-apt-pkgs-action/src/internal/logging"
)

type AptPackage struct {
	Name    string
	Version string
}

type AptPackages []AptPackage

func (ps AptPackages) serialize() string {
	tokens := []string{}
	for _, p := range ps {
		tokens = append(tokens, p.Name+"="+p.Version)
	}
	return strings.Join(tokens, " ")
}

// Gets the APT based packages as a sorted by name list (normalized).
func getPackages(executor exec.Executor, names []string) AptPackages {
	prefixArgs := []string{"--quiet=0", "--no-all-versions", "show"}
	execution := executor.Exec("apt-cache", append(prefixArgs, names...)...)

	err := execution.Error()
	if err != nil {
		logging.Fatal(err)
	}

	pkgs := []AptPackage{}
	errorMessages := []string{}

	for _, paragraph := range strings.Split(execution.Stdout, "\n\n") {
		pkg := AptPackage{}
		for _, line := range strings.Split(paragraph, "\n") {
			if strings.HasPrefix(line, "Package: ") {
				pkg.Name = strings.TrimSpace(strings.SplitN(line, ":", 2)[1])
			} else if strings.HasPrefix(line, "Version: ") {
				pkg.Version = strings.TrimSpace(strings.SplitN(line, ":", 2)[1])
			} else if strings.HasPrefix(line, "N: Unable to locate package ") || strings.HasPrefix(line, "E: ") {
				if !common.ContainsString(errorMessages, line) {
					errorMessages = append(errorMessages, line)
				}
			}
		}
		if pkg.Name != "" {
			pkgs = append(pkgs, pkg)
		}
	}

	if len(errorMessages) > 0 {
		logging.Fatalf("Errors encountered in apt-cache output (see below):\n%s", strings.Join(errorMessages, "\n"))
	}

	sort.Slice(pkgs, func(i, j int) bool {
		return pkgs[i].Name < pkgs[j].Name
	})

	return pkgs
}

func getExecutor(replayFilename string) exec.Executor {
	if len(replayFilename) == 0 {
		return &exec.BinExecutor{}
	}
	return exec.NewReplayExecutor(replayFilename)
}

func main() {
	debug := flag.Bool("debug", false, "Log diagnostic information to a file alongside the binary.")

	replayFilename := flag.String("replayfile", "",
		"Replay command output from a specified file rather than executing a binary."+
			"The file should be in the same format as the log generated by the debug flag.")

	flag.Parse()
	unparsedFlags := flag.Args()

	logging.Init(os.Args[0]+".log", *debug)

	executor := getExecutor(*replayFilename)

	if len(unparsedFlags) < 2 {
		logging.Fatalf("Expected at least 2 non-flag arguments but found %d.", len(unparsedFlags))
		return
	}
	command := unparsedFlags[0]
	pkgNames := unparsedFlags[1:]

	switch command {

	case "normalized-list":
		pkgs := getPackages(executor, pkgNames)
		fmt.Println(pkgs.serialize())

	default:
		logging.Fatalf("Command '%s' not recognized.", command)
	}
}
