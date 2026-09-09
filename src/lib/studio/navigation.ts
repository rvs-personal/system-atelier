export function parentRoute(route: string) {
  const parts = route.replace(/^#/, '').split('/').filter(Boolean);
  if (parts[0] === 'lab' && /^\d+$/.test(parts[1] ?? '')) {
    const step = Number(parts[2]);
    return step > 1 ? `lab/${parts[1]}/${step - 1}` : 'lab';
  }
  if (
    parts[0] === 'lld' &&
    ['lru', 'parking', 'bucket', 'order'].includes(parts[1])
  )
    return 'lld/simulations';
  return parts.length > 1 ? parts.slice(0, -1).join('/') : 'studio';
}
