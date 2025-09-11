package main

import (
	"bufio"
	"fmt"
	"regexp"
	"strings"
)

// dedent removes common leading indentation from non-empty lines.
// It also normalizes CRLF -> LF and strips a single leading newline.
func dedent(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.TrimPrefix(s, "\n")

	lines := strings.Split(s, "\n")
	min := -1
	for _, ln := range lines {
		if strings.TrimSpace(ln) == "" {
			continue
		}
		ind := len(ln) - len(strings.TrimLeft(ln, " \t"))
		if min == -1 || ind < min {
			min = ind
		}
	}
	if min <= 0 {
		return s
	}
	for i, ln := range lines {
		if len(ln) >= min {
			lines[i] = ln[min:]
		} else {
			lines[i] = strings.TrimLeft(ln, " \t")
		}
	}
	return strings.Join(lines, "\n")
}

type ScriptBuilder struct {
	textBuilder strings.Builder
}

func (s *ScriptBuilder) WriteComment(format string, a ...any) {
	var c strings.Builder
	scanner := bufio.NewScanner(strings.NewReader(fmt.Sprintf(format, a...)))
	for scanner.Scan() {
		c.WriteString("# ")
		c.WriteString(scanner.Text())
		c.WriteByte('\n')
	}
	fmt.Fprint(&s.textBuilder, c.String())
}

func (s *ScriptBuilder) WriteCommentSection(format string, a ...any) {
	s.WriteBlock("\n\n#" + strings.Repeat("=", 99))
	s.WriteComment(format, a...)
	s.WriteBlock("#" + strings.Repeat("=", 99) + "\n")
}

func (s *ScriptBuilder) WriteBlock(format string, a ...any) {
	fmt.Fprintln(&s.textBuilder, fmt.Sprintf(dedent(format), a...))
}

func (s *ScriptBuilder) String() string {
	return s.textBuilder.String()
}

type BashConverter struct {
	action        Action
	scriptBuilder ScriptBuilder
	githubVars    githubVars
}

func NewBashConverter(action Action) *BashConverter {
	githubVars := make(map[string]githubVar)
	for _, v := range []githubVar{
		newGithubVar("runner.arch", "X86_64"),
		newGithubVar("github.action_path", "../../"),
		newGithubVar("inputs.packages", "xdot,rolldice"),
		newGithubVar("inputs.version", "0"),
		newGithubVar("inputs.global_version", ""),
		newGithubVar("inputs.execute_install_scripts", "false"),
		newGithubVar("inputs.refresh", "false"),
		newGithubVar("inputs.debug", "false"),
	} {
		githubVars[v.name] = v
	}
	return &BashConverter{
		action:        action,
		scriptBuilder: ScriptBuilder{},
		githubVars:    githubVars,
	}
}

func (b *BashConverter) Convert() string {
	b.handleAction()
	return b.scriptBuilder.String()
}

func (b *BashConverter) convertShellLines(step Step, lines string) string {
	var result []string
	scanner := bufio.NewScanner(strings.NewReader(lines))
	for scanner.Scan() {
		converted := b.convertShellLine(step, scanner.Text())
		result = append(result, converted)
	}
	return strings.Join(result, "\n")
}

// echo\s+

func (b *BashConverter) convertShellLine(step Step, line string) string {
	line = b.githubVars.convert(line)

	env_pattern := `^\s*echo\s+"([\w\-_]+)=(.*)"\s*>>\s*.*GITHUB_ENV.*`
	env_re := regexp.MustCompile(env_pattern)
	if m := env_re.FindStringSubmatch(line); m != nil {
		return fmt.Sprintf(`GH_ENV_%s="%s"`, convertToShellVar(m[1]), b.githubVars.convert(m[2]))
	}

	out_pattern := `^\s*echo\s+"([\w\-_]+)=(.*)"\s*>>\s*.*GITHUB_OUTPUT.*`
	out_re := regexp.MustCompile(out_pattern)
	if m := out_re.FindStringSubmatch(line); m != nil {
		return fmt.Sprintf(
			`GH_OUTPUT_%s_%s="%s"`,
			convertToShellVar(step.ID),
			convertToShellVar(m[1]),
			b.githubVars.convert(m[2]),
		)
	}
	return line
}

func (b *BashConverter) handleExternalAction(step Step) {
	handlers := map[string]func(){
		"actions/cache/restore@v4": func() {
			path := b.convertShellLine(step, step.With["path"])
			key := b.convertShellLine(step, step.With["key"])
			shellVarPrefix := "STEP_" + convertToShellVar(step.ID) + "_WITH"
			pathVar := fmt.Sprintf("%s_PATH", shellVarPrefix)
			keyVar := fmt.Sprintf("%s_KEY", shellVarPrefix)
			b.scriptBuilder.WriteBlock(`
			%s="%s"
			%s="%s"
			if [[ -d "${%s}" ]]; then
			  OUTPUT_CACHE_HIT=true
			else
				OUTPUT_CACHE_HIT=false
				mkdir "${%s}"
			fi
			`, pathVar, path, keyVar, key, key, key)
		},
	}
	if handlers[step.Uses] != nil {
		handlers[step.Uses]()
	}
	b.scriptBuilder.WriteComment("NO HANDLER FOUND for %s", step.Uses)
}

func convertToShellVar(name string) string {
	return strings.ToUpper(strings.ReplaceAll(strings.ReplaceAll(name, ".", "_"), "-", "_"))
}

type githubVar struct {
	name      string
	shellName string
	shellVal  string
}

func newGithubVar(name, shellVal string) githubVar {
	return githubVar{
		name:      name,
		shellName: convertToShellVar(name),
		shellVal:  shellVal,
	}
}

type githubVars map[string]githubVar

func (v *githubVars) convert(line string) string {
	// Build pattern to match ${{ var }} style variables
	// The pattern matches any known github variable name
	names := make([]string, 0, len(*v))
	for name := range *v {
		names = append(names, regexp.QuoteMeta(name))
	}
	pattern := fmt.Sprintf(`\${{[[:space:]]*(%s)[[:space:]]*}}`, strings.Join(names, "|"))

	re := regexp.MustCompile(pattern)
	return re.ReplaceAllStringFunc(line, func(match string) string {
		// Extract the variable name from between ${{ and }}
		varName := re.FindStringSubmatch(match)[1]
		if gvar, ok := (*v)[varName]; ok {
			// If the variable exists, replace with ${SHELL_VAR}
			return fmt.Sprintf("${%s}", gvar.shellName)
		}
		// If variable not found, return original text
		return match
	})
}

func (b *BashConverter) handleAction() {
	b.scriptBuilder.WriteBlock("#!/bin/bash\n")
	b.scriptBuilder.WriteBlock(strings.Repeat("#", 100) + "\n#")
	b.scriptBuilder.WriteComment("%s", b.action.ShortString())
	b.scriptBuilder.WriteBlock(strings.Repeat("#", 100) + "\n")
	b.scriptBuilder.WriteBlock("set -e\n")

	for _, v := range b.githubVars {
		if v.shellVal != "" {
			b.scriptBuilder.WriteBlock(`%s="%s"`, v.shellName, v.shellVal)
		}
	}

	for _, step := range b.action.Runs.Steps {
		if step.ID != "" {
			b.scriptBuilder.WriteCommentSection("Step ID: %s", step.ID)
		} else {
			b.scriptBuilder.WriteCommentSection("Step ID: n/a")
		}

		if step.Uses != "" {
			b.handleExternalAction(step)
		}
		if len(step.Env) > 0 {
			for k, v := range step.Env {
				b.scriptBuilder.WriteBlock(
					`STEP_%s_ENV_%s="%s"`,
					convertToShellVar(step.ID),
					convertToShellVar(k),
					b.githubVars.convert(v),
				)
			}
		}
		if step.Shell != "" && step.Shell != "bash" {
			b.scriptBuilder.WriteComment(
				"Note: Original shell was %q, but this script uses bash.\n",
				step.Shell,
			)
		}
		if step.Run != "" {
			b.scriptBuilder.WriteBlock("%s\n", b.convertShellLines(step, step.Run))
		}
	}
	// b.scriptBuilder.WriteBlock(`
	// 	#!/bin/bash

	// 	set -e
	// `)
}
