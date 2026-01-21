/**
 * Artifact State Management with Jotai
 *
 * Uses atomFamily to create isolated artifacts per session.
 * Updates to artifacts in one session don't trigger re-renders in other sessions.
 */

import { atom } from 'jotai'
import { atomFamily } from 'jotai-family'
import type { AnyArtifact, ArtifactMeta } from '../../shared/types'
import { extractArtifactMeta } from '../../shared/artifact-types'

/**
 * Atom family for artifacts per session
 * Each session gets its own artifacts array
 */
export const sessionArtifactsAtomFamily = atomFamily(
  (_sessionId: string) => atom<AnyArtifact[]>([]),
  (a, b) => a === b
)

/**
 * Atom family for active artifact ID per session
 * Tracks which artifact is currently displayed in the Canvas
 */
export const activeArtifactIdAtomFamily = atomFamily(
  (_sessionId: string) => atom<string | null>(null),
  (a, b) => a === b
)

/**
 * Atom family for canvas visibility per session
 * Controls whether the Canvas panel is shown
 */
export const canvasVisibleAtomFamily = atomFamily(
  (_sessionId: string) => atom<boolean>(false),
  (a, b) => a === b
)

/**
 * Atom family for canvas panel width per session (percentage)
 * Persists the user's preferred split width
 */
export const canvasWidthAtomFamily = atomFamily(
  (_sessionId: string) => atom<number>(50),
  (a, b) => a === b
)

/**
 * Action atom: add an artifact to a session
 */
export const addArtifactAtom = atom(
  null,
  (get, set, sessionId: string, artifact: AnyArtifact) => {
    const artifactsAtom = sessionArtifactsAtomFamily(sessionId)
    const artifacts = get(artifactsAtom)
    set(artifactsAtom, [...artifacts, artifact])

    // Auto-select the new artifact and show canvas
    set(activeArtifactIdAtomFamily(sessionId), artifact.id)
    set(canvasVisibleAtomFamily(sessionId), true)
  }
)

/**
 * Action atom: update an existing artifact
 */
export const updateArtifactAtom = atom(
  null,
  (get, set, sessionId: string, artifactId: string, changes: Partial<AnyArtifact>) => {
    const artifactsAtom = sessionArtifactsAtomFamily(sessionId)
    const artifacts = get(artifactsAtom)
    const index = artifacts.findIndex(a => a.id === artifactId)

    if (index !== -1) {
      const updated = {
        ...artifacts[index],
        ...changes,
        updatedAt: Date.now(),
        version: artifacts[index].version + 1,
      } as AnyArtifact

      const newArtifacts = [...artifacts]
      newArtifacts[index] = updated
      set(artifactsAtom, newArtifacts)
    }
  }
)

/**
 * Action atom: delete an artifact from a session
 */
export const deleteArtifactAtom = atom(
  null,
  (get, set, sessionId: string, artifactId: string) => {
    const artifactsAtom = sessionArtifactsAtomFamily(sessionId)
    const artifacts = get(artifactsAtom)
    const newArtifacts = artifacts.filter(a => a.id !== artifactId)
    set(artifactsAtom, newArtifacts)

    // If the deleted artifact was active, select another or hide canvas
    const activeArtifactId = get(activeArtifactIdAtomFamily(sessionId))
    if (activeArtifactId === artifactId) {
      if (newArtifacts.length > 0) {
        set(activeArtifactIdAtomFamily(sessionId), newArtifacts[newArtifacts.length - 1].id)
      } else {
        set(activeArtifactIdAtomFamily(sessionId), null)
        set(canvasVisibleAtomFamily(sessionId), false)
      }
    }
  }
)

/**
 * Action atom: set the active artifact for a session
 */
export const setActiveArtifactAtom = atom(
  null,
  (_get, set, sessionId: string, artifactId: string | null) => {
    set(activeArtifactIdAtomFamily(sessionId), artifactId)
    if (artifactId) {
      set(canvasVisibleAtomFamily(sessionId), true)
    }
  }
)

/**
 * Action atom: toggle canvas visibility for a session
 */
export const toggleCanvasAtom = atom(
  null,
  (get, set, sessionId: string) => {
    const canvasAtom = canvasVisibleAtomFamily(sessionId)
    const visible = get(canvasAtom)
    set(canvasAtom, !visible)
  }
)

/**
 * Action atom: set canvas width for a session
 */
export const setCanvasWidthAtom = atom(
  null,
  (_get, set, sessionId: string, width: number) => {
    set(canvasWidthAtomFamily(sessionId), Math.max(20, Math.min(80, width)))
  }
)

/**
 * Derived atom: get artifact metadata list for a session (lightweight)
 */
export const getArtifactMetasAtom = atomFamily(
  (sessionId: string) =>
    atom(get => {
      const artifacts = get(sessionArtifactsAtomFamily(sessionId))
      return artifacts.map(extractArtifactMeta)
    }),
  (a, b) => a === b
)

/**
 * Derived atom: get the currently active artifact for a session
 */
export const getActiveArtifactAtom = atomFamily(
  (sessionId: string) =>
    atom(get => {
      const artifacts = get(sessionArtifactsAtomFamily(sessionId))
      const activeId = get(activeArtifactIdAtomFamily(sessionId))
      if (!activeId) return null
      return artifacts.find(a => a.id === activeId) ?? null
    }),
  (a, b) => a === b
)

/**
 * Action atom: clean up artifacts when session is deleted
 * Should be called from removeSessionAtom in sessions.ts
 */
export const cleanupSessionArtifactsAtom = atom(
  null,
  (_get, _set, sessionId: string) => {
    // Remove all atom family entries for this session
    sessionArtifactsAtomFamily.remove(sessionId)
    activeArtifactIdAtomFamily.remove(sessionId)
    canvasVisibleAtomFamily.remove(sessionId)
    canvasWidthAtomFamily.remove(sessionId)
  }
)

/**
 * Action atom: initialize artifacts for a session from storage
 */
export const initializeSessionArtifactsAtom = atom(
  null,
  (_get, set, sessionId: string, artifacts: AnyArtifact[]) => {
    set(sessionArtifactsAtomFamily(sessionId), artifacts)

    // Auto-select the most recently updated artifact if any exist
    if (artifacts.length > 0) {
      const mostRecent = artifacts.reduce((prev, curr) =>
        curr.updatedAt > prev.updatedAt ? curr : prev
      )
      set(activeArtifactIdAtomFamily(sessionId), mostRecent.id)
    }
  }
)

// HMR: Force full page refresh when this file changes.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate()
  })
}
