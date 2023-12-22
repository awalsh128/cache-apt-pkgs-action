package exec

import (
	"bytes"
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

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	var stdout bytes.Buffer
	cmd.Stdout = &stdout

	err := cmd.Run()
	execution := &Execution{
		Cmd:      name + " " + strings.Join(arg, " "),
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		ExitCode: cmd.ProcessState.ExitCode(),
	}

	logging.DebugLazy(func() string {
		return fmt.Sprintf("EXECUTION-OBJ-START\n%s\nEXECUTION-OBJ-END", execution.Serialize())
	})
	if err != nil {
		logging.Fatal(execution.Error())
	}
	return execution
}
