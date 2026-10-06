export interface DocumentSection {
  heading: string;
  level: number;
  content: string;
}

export interface ProfileManifestEntry {
  path: string;
  type: string;
}

export interface ProfileManifest {
  id: string;
  name: string;
  version: string;
  documents: ProfileManifestEntry[];
}

export interface ProfileDocument {
  id: string;
  profileId: string;
  path: string;
  type: string;
  title?: string;
  content: string;
  sections: DocumentSection[];
  tags: string[];
}

export interface Profile {
  id: string;
  name: string;
  version: string;
  documents: ProfileDocument[];
}

export interface ProfileChunk {
  id: string;
  profileId: string;
  documentId: string;
  type: string;
  title?: string;
  content: string;
  path: string;
  tags: string[];
}

export interface ProfileIndex {
  documents: ProfileDocument[];
  chunks: ProfileChunk[];
}

export interface RetrievalOptions {
  topK?: number;
  minScore?: number;
}

export interface RetrievalResult {
  chunk: ProfileChunk;
  score: number;
}

export interface CareerContextItem {
  title?: string;
  content: string;
  profileId: string;
  documentId: string;
  path: string;
  chunkId: string;
  score: number;
}

export interface CareerContext {
  query: string;
  candidateName: string;
  items: CareerContextItem[];
}
