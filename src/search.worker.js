import { findMatches } from "./search-core";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      id: data.id,
      ...findMatches(data.content, data.query, data.options),
    });
  } catch (e) {
    self.postMessage({ id: data.id, error: e.message });
  }
};
