import { Redirect } from 'expo-router';

/**
 * App entry route.
 *
 * The dashboard lives in the (tabs) group together with Scan, History and
 * Profile so that each page keeps its own navigation state, which means this
 * route only needs to forward the root URL into the Dashboard tab.
 */
export default function Index() {
  return <Redirect href="/dashboard" />;
}
