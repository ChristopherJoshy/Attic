const DESTRUCTIVE_PATTERNS = [
    /rm\s+-rf\s+\/\b/,
    /rm\s+-rf\s+~\//,
    /dd\s+if=.*\s+of=\/dev\/sd/,
    /dd\s+if=.*\s+of=\/dev\/nvme/,
    /mkfs\./,
    /:>\s*\/dev\/sd/,
    /sh\s+-c\s*".*curl.*\|.*sh"/,
    /bash\s+-c\s*".*curl.*\|.*sh"/,
    /wget.*\|\s*(ba)?sh/,
    /curl.*\|\s*(ba)?sh/,
    /chmod\s+-R\s+777\s+\//,
    /chown\s+-R.*\s+\//,
    />\s*\/dev\/sda/,
    /mv\s+\/\s/,
    /cp\s+\/dev\/zero\s+\/dev\/sd/,
];
const PACKAGE_MANAGER_MAP = {
    'apt': ['apt', 'apt-get', 'dpkg'],
    'dnf': ['dnf', 'yum', 'rpm'],
    'pacman': ['pacman', 'yay', 'paru'],
    'zypper': ['zypper'],
};
export function validateCommand(command, detectedPM) {
    for (const pattern of DESTRUCTIVE_PATTERNS) {
        if (pattern.test(command)) {
            return { blocked: true, risk: 'high', reason: `Matches destructive pattern: ${pattern.source}`, incompatiblePM: false };
        }
    }
    let incompatiblePM = false;
    if (detectedPM) {
        const allowedTools = PACKAGE_MANAGER_MAP[detectedPM] || [];
        const allPMTools = Object.values(PACKAGE_MANAGER_MAP).flat();
        const usedPMTools = allPMTools.filter(tool => new RegExp(`\\b${tool}\\b`).test(command));
        if (usedPMTools.length > 0) {
            const wrongTools = usedPMTools.filter(t => !allowedTools.includes(t));
            if (wrongTools.length > 0) {
                incompatiblePM = true;
            }
        }
    }
    const needsSudo = /\bsudo\b/.test(command);
    const modifiesSystem = /\b(install|remove|purge|update|upgrade|systemctl|modprobe|insmod)\b/.test(command);
    const writesToSystemFiles = />\s*\/(etc|usr|var|boot|sys|proc)\//.test(command);
    let risk = 'low';
    let reason = 'Read-only or informational command';
    if (needsSudo || writesToSystemFiles) {
        risk = 'high';
        reason = 'Requires elevated privileges or modifies system files';
    }
    else if (modifiesSystem) {
        risk = 'medium';
        reason = 'Modifies installed packages or system services';
    }
    if (incompatiblePM) {
        reason += `. Warning: uses package manager incompatible with detected system (${detectedPM})`;
        risk = 'high';
    }
    return { blocked: false, risk, reason, incompatiblePM };
}
export function getDryRunEquivalent(command) {
    if (/\bapt-get\s+install\b/.test(command))
        return command.replace('apt-get install', 'apt-get -s install');
    if (/\bapt\s+install\b/.test(command))
        return command.replace('apt install', 'apt -s install');
    if (/\bdnf\s+install\b/.test(command))
        return command + ' --setopt=tsflags=test';
    if (/\bpacman\s+-S\b/.test(command))
        return command.replace('-S', '-Sp');
    return null;
}
//# sourceMappingURL=command-validator.js.map