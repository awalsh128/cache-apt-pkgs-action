package main

import (
	"flag"
	"fmt"
	"os"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/common"
	"awalsh128.com/cache-apt-pkgs-action/src/internal/exec"
	"awalsh128.com/cache-apt-pkgs-action/src/internal/logging"
)

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
		pkgs, err := common.GetAptPackages(executor, pkgNames)
		if err != nil {
			logging.Fatalf("Encountered error resolving some or all package names, see combined std[out,err] below.\n%s", err.Error())
		}
		fmt.Println(pkgs.Serialize())

	default:
		logging.Fatalf("Command '%s' not recognized.", command)
	}
}
