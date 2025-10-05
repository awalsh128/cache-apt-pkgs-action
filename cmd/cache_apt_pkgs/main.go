package main

import (
	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
)

func main() {
	logging.Init(true)

	commands := CreateCmds(
		GetCreateKeyCmd(),
		GetInstallCmd(),
		GetRestoreCmd(),
		GetSetupCmd(),
		GetCleanupCmd(),
		GetValidateCmd(),
	)
	cmd, pkgArgs := commands.Parse()
	err := cmd.Run(cmd, pkgArgs)
	if err != nil {
		logging.Fatalf("error: %v\n", err)
	}
}
