const publicAreas = new Set(['studio', 'learn', 'lab', 'lld']);
export function isPublicWorkspace(route: string) {
  return publicAreas.has(route.replace(/^#/, '').split('/')[0]);
}
export function signInHref(route: string) {
  return '#signin?next=' + encodeURIComponent(safeReturnRoute(route));
}
export function safeReturnRoute(route: string) {
  const value = route.replace(/^#/, '');
  return /^(studio|learn|lab|lld|interview)(\/[-a-zA-Z0-9_]+)*$/.test(value)
    ? value
    : 'studio';
}
export const guestKey = (key: string) => 'atelier-guest-v1:' + key;
