package exec

import (
	"bufio"
	"os"
	"strings"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/logging"
)

// An executor that replays execution results from a recorded result.
type ReplayExecutor struct {
	logFilepath string
	cmdExecs    map[string]*Execution
}

func NewReplayExecutor(logFilepath string) *ReplayExecutor {
	file, err := os.Open(logFilepath)
	if err != nil {
		logging.Fatal(err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)

	cmdExecs := make(map[string]*Execution)

	for scanner.Scan() {
		line := scanner.Text()
		if strings.Contains(line, "EXECUTION-OBJ-START") {
			payload := ""
			for scanner.Scan() {
				line = scanner.Text()
				if strings.Contains(line, "EXECUTION-OBJ-END") {
					execution := DeserializeExecution(payload)
					cmdExecs[execution.Cmd] = execution
					break
				} else {
					payload += line + "\n"
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		logging.Fatal(err)
	}
	return &ReplayExecutor{logFilepath, cmdExecs}
}

func (e *ReplayExecutor) getCmds() []string {
	cmds := []string{}
	for cmd := range e.cmdExecs {
		cmds = append(cmds, cmd)
	}
	return cmds
}

func (e *ReplayExecutor) Exec(name string, arg ...string) *Execution {
	cmd := name + " " + strings.Join(arg, " ")
	value, ok := e.cmdExecs[cmd]
	if !ok {
		var available string
		if len(e.getCmds()) > 0 {
			available = "\n" + strings.Join(e.getCmds(), "\n")
		} else {
			available = " NONE"
		}
		logging.Fatalf(
			"Unable to replay command '%s'.\n"+
				"No command found in the debug log; available commands:%s", cmd, available)
	}
	return value
}
