package exec

import (
	"fmt"
	"os/exec"
	"strings"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/logging"
)

// An executor that proxies command executions from the OS.
//
// NOTE: Extra abstraction layer needed for testing and replay.
type BinExecutor struct{}

func (c *BinExecutor) Exec(name string, arg ...string) *Execution {
	cmd := exec.Command(name, arg...)

	err := cmd.Run()

	out, outErr := cmd.CombinedOutput()
	if outErr != nil {
		logging.Fatal(outErr)
	}

	execution := &Execution{
		Cmd:         name + " " + strings.Join(arg, " "),
		CombinedOut: string(out),
		ExitCode:    cmd.ProcessState.ExitCode(),
	}

	logging.DebugLazy(func() string {
		return fmt.Sprintf("EXECUTION-OBJ-START\n%s\nEXECUTION-OBJ-END", execution.Serialize())
	})
	if err != nil {
		logging.Fatal(execution.Error())
	}
	return execution
}
