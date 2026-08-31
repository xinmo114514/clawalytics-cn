export const NOTIFICATION_SOURCES = ['openclaw', 'hermes'];

const SOURCE_LABELS = {
  openclaw: 'OpenClaw',
  hermes: 'Hermes',
};

export function normalizeStats(stats) {
  const totalTokens = stats?.totalTokens ?? {};

  return {
    totalCost: Number(stats?.totalCost ?? 0),
    monthCost: Number(stats?.monthCost ?? 0),
    totalTokens: {
      input: Number(totalTokens.input ?? 0),
      output: Number(totalTokens.output ?? 0),
      cacheRead: Number(totalTokens.cacheRead ?? 0),
      cacheCreation: Number(totalTokens.cacheCreation ?? 0),
    },
    cacheSavings: Number(stats?.cacheSavings ?? 0),
    activeSessionsThisMonth: Number(stats?.activeSessionsThisMonth ?? 0),
  };
}

export function createEmptyStats() {
  return normalizeStats();
}

export function getTotalTokens(stats) {
  return (
    stats.totalTokens.input
    + stats.totalTokens.output
    + stats.totalTokens.cacheRead
    + stats.totalTokens.cacheCreation
  );
}

export function sumStats(sourceSnapshots) {
  return NOTIFICATION_SOURCES.reduce((total, source) => {
    const stats = sourceSnapshots?.[source] ?? createEmptyStats();
    total.totalCost += stats.totalCost;
    total.monthCost += stats.monthCost;
    total.cacheSavings += stats.cacheSavings;
    total.activeSessionsThisMonth += stats.activeSessionsThisMonth;
    total.totalTokens.input += stats.totalTokens.input;
    total.totalTokens.output += stats.totalTokens.output;
    total.totalTokens.cacheRead += stats.totalTokens.cacheRead;
    total.totalTokens.cacheCreation += stats.totalTokens.cacheCreation;
    return total;
  }, createEmptyStats());
}

function diffStats(previous, current) {
  return {
    totalCost: Math.max(0, current.totalCost - previous.totalCost),
    totalTokens: {
      input: Math.max(0, current.totalTokens.input - previous.totalTokens.input),
      output: Math.max(0, current.totalTokens.output - previous.totalTokens.output),
      cacheRead: Math.max(0, current.totalTokens.cacheRead - previous.totalTokens.cacheRead),
      cacheCreation: Math.max(0, current.totalTokens.cacheCreation - previous.totalTokens.cacheCreation),
    },
  };
}

function hasCounterRegression(previous, current) {
  return current.totalCost < previous.totalCost
    || current.totalTokens.input < previous.totalTokens.input
    || current.totalTokens.output < previous.totalTokens.output
    || current.totalTokens.cacheRead < previous.totalTokens.cacheRead
    || current.totalTokens.cacheCreation < previous.totalTokens.cacheCreation;
}

export function diffSourceSnapshots(previousSnapshots, currentSnapshots) {
  const deltas = {};
  const resetSources = [];

  for (const source of NOTIFICATION_SOURCES) {
    const previous = previousSnapshots?.[source];
    const current = currentSnapshots?.[source] ?? createEmptyStats();

    if (!previous) {
      deltas[source] = diffStats(createEmptyStats(), current);
      continue;
    }

    if (hasCounterRegression(previous, current)) {
      resetSources.push(source);
      deltas[source] = diffStats(current, current);
      continue;
    }

    deltas[source] = diffStats(previous, current);
  }

  return { deltas, resetSources };
}

export function hasCostDelta(delta) {
  return delta.totalCost > 0.000001;
}

export function hasTokenDelta(delta) {
  return getTotalTokens(delta) > 0;
}

export function hasMeaningfulDelta(delta) {
  return hasCostDelta(delta) || hasTokenDelta(delta);
}

export function shouldShowNotification(delta, trigger, enabled = true) {
  if (!enabled) return false;

  const costChanged = hasCostDelta(delta);
  const tokensChanged = hasTokenDelta(delta);

  switch (trigger) {
    case 'cost':
      return costChanged;
    case 'tokens':
      return tokensChanged;
    case 'both':
      return costChanged && tokensChanged;
    case 'activity':
    default:
      return costChanged || tokensChanged;
  }
}

export function buildNotification({
  previousSnapshots,
  currentSnapshots,
  trigger,
  enabled,
  translate,
  formatCurrency,
  formatInteger,
}) {
  const { deltas, resetSources } = diffSourceSnapshots(
    previousSnapshots,
    currentSnapshots
  );
  const delta = NOTIFICATION_SOURCES.reduce((total, source) => {
    const sourceDelta = deltas[source];
    total.totalCost += sourceDelta.totalCost;
    total.totalTokens.input += sourceDelta.totalTokens.input;
    total.totalTokens.output += sourceDelta.totalTokens.output;
    total.totalTokens.cacheRead += sourceDelta.totalTokens.cacheRead;
    total.totalTokens.cacheCreation += sourceDelta.totalTokens.cacheCreation;
    return total;
  }, { totalCost: 0, totalTokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 } });

  const sourceKeys = NOTIFICATION_SOURCES.filter((source) =>
    hasMeaningfulDelta(deltas[source])
  );

  if (!shouldShowNotification(delta, trigger, enabled) || sourceKeys.length === 0) {
    return { deltas, resetSources, delta, sourceKeys, notification: null };
  }

  const lines = sourceKeys.map((source) => {
    const sourceDelta = deltas[source];
    const parts = [];
    const tokenTotal = getTotalTokens(sourceDelta);

    if (tokenTotal > 0) {
      parts.push(translate(
        `新增 ${formatInteger(tokenTotal)} 词元`,
        `Added ${formatInteger(tokenTotal)} tokens`
      ));
    }
    if (sourceDelta.totalCost > 0) {
      parts.push(translate(
        `成本 +${formatCurrency(sourceDelta.totalCost)}`,
        `Cost +${formatCurrency(sourceDelta.totalCost)}`
      ));
    }

    return translate(
      `${SOURCE_LABELS[source]}：${parts.join('，')}`,
      `${SOURCE_LABELS[source]}: ${parts.join(', ')}`
    );
  });
  const labels = sourceKeys.map((source) => SOURCE_LABELS[source]);
  const label = labels.join(' + ');
  const currentTotal = sumStats(currentSnapshots);

  return {
    deltas,
    resetSources,
    delta,
    sourceKeys,
    notification: {
      title: translate(`${label} 用量已更新`, `${label} usage updated`),
      body: `${lines.join('\n')}\n${translate('累计成本', 'Total cost')} ${formatCurrency(currentTotal.totalCost)}`,
    },
  };
}
