package main

import (
	"awalsh128.com/cache-apt-pkgs-action/cmd/cache_apt_pkgs/cmdflags"
	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
)

func main() {
	logging.Init(true)

	commands := cmdflags.CreateCmds(
		GetCreateKeyCmd(),
		GetInstallCmd(),
		GetRestoreCmd(),
		GetValidateCmd(),
	)
	cmd, pkgArgs, err := commands.Parse()
	if err != nil {
		logging.Fatalf("error: %v\n", err)
	}
	err = cmd.Run(cmd, pkgArgs)
	if err != nil {
		logging.Fatalf("error: %v\n", err)
	}
}
