/** A string that depends on a number: "1 photo" / "3 photos". Chosen by the `count` param. */
export type Plural = { one: string; other: string };

/** What a namespace file in `en/` must be. */
export type Namespace = Record<string, string | Plural>;

/** A translation of an English namespace: the same keys, the same kind of entry. */
export type Translation<T> = { [K in keyof T]: T[K] extends string ? string : Plural };
