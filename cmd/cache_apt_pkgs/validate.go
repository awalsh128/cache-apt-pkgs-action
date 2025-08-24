package main

import (
	"flag"
	"fmt"
	"strings"

	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

func validate(cmd *Cmd, pkgArgs pkgs.Packages) error {
	apt, err := pkgs.NewApt()
	if err != nil {
		return fmt.Errorf("error initializing APT: %v", err)
	}

	errMsgs := make([]string, 0)
	for i := 0; i < pkgArgs.Len(); i++ {
		pkg := pkgArgs.Get(i)
		if _, err := apt.Validate(pkg); err != nil {
			logging.Info("Package %s is invalid: %v.", pkg.String(), err)
			errMsgs = append(errMsgs, fmt.Sprintf("%s - %v", pkg.String(), err))
		} else {
			logging.Info("Package %s is valid.", pkg.String())
		}
	}

	if len(errMsgs) > 0 {
		return fmt.Errorf("package validation failed:\n - %s", strings.Join(errMsgs, "\n"))
	}
	return nil
}

func GetValidateCmd() *Cmd {
	cmd := &Cmd{
		Name:        "validate",
		Description: "Validate package arguments",
		Flags:       flag.NewFlagSet("validate", flag.ExitOnError),
		Run:         validate,
	}
	cmd.ExamplePackages = ExamplePackages
	return cmd
}
