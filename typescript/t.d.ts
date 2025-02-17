import type {
  $OmitArrayKeys,
  $PreservedValue,
  $Dictionary,
  $SpecialObject,
} from "./helpers.d.ts";
import type {
  TypeOptions,
  Namespace,
  FlatNamespace,
  DefaultNamespace,
  TOptions,
} from "./options.d.ts";

type $IsResourcesDefined = [keyof _Resources] extends [never] ? false : true;
type $ValueIfResourcesDefined<Value, Fallback> =
  $IsResourcesDefined extends true ? Value : Fallback;
type $FirstNamespace<Ns extends Namespace> = Ns extends readonly any[]
  ? Ns[0]
  : Ns;

/**
 * @MyComment 2. それぞれ利用しやすいように型エイリアスをつけて取り出す
 */
type _ReturnObjects = TypeOptions["returnObjects"];
type _ReturnNull = TypeOptions["returnNull"];
type _KeySeparator = TypeOptions["keySeparator"];
type _NsSeparator = TypeOptions["nsSeparator"];
type _PluralSeparator = TypeOptions["pluralSeparator"];
type _ContextSeparator = TypeOptions["contextSeparator"];
type _FallbackNamespace = TypeOptions["fallbackNS"];
type _Resources = TypeOptions["resources"];
type _JSONFormat = TypeOptions["jsonFormat"];
type _InterpolationPrefix = TypeOptions["interpolationPrefix"];
type _InterpolationSuffix = TypeOptions["interpolationSuffix"];

type Resources = $ValueIfResourcesDefined<_Resources, $Dictionary<string>>;

type PluralSuffix = "zero" | "one" | "two" | "few" | "many" | "other";

type WithOrWithoutPlural<Key> = _JSONFormat extends "v4"
  ? Key extends `${infer KeyWithoutOrdinalPlural}${_PluralSeparator}ordinal${_PluralSeparator}${PluralSuffix}`
    ? KeyWithoutOrdinalPlural | Key
    : Key extends `${infer KeyWithoutPlural}${_PluralSeparator}${PluralSuffix}`
    ? KeyWithoutPlural | Key
    : Key
  : Key;

type JoinKeys<K1, K2> = `${K1 & string}${_KeySeparator}${K2 & string}`;
type AppendNamespace<Ns, Keys> = `${Ns & string}${_NsSeparator}${Keys &
  string}`;

/******************************************************
 * Build all keys and key prefixes based on Resources *
 ******************************************************/
type KeysBuilderWithReturnObjects<Res, Key = keyof Res> = Key extends keyof Res
  ? Res[Key] extends $Dictionary
    ?
        | JoinKeys<Key, WithOrWithoutPlural<keyof $OmitArrayKeys<Res[Key]>>>
        | JoinKeys<Key, KeysBuilderWithReturnObjects<Res[Key]>>
    : never
  : never;

type KeysBuilderWithoutReturnObjects<
  Res,
  Key = keyof $OmitArrayKeys<Res>
> = Key extends keyof Res
  ? Res[Key] extends $Dictionary
    ? JoinKeys<Key, KeysBuilderWithoutReturnObjects<Res[Key]>>
    : Key
  : never;

type KeysBuilder<Res, WithReturnObjects> = $IsResourcesDefined extends true
  ? WithReturnObjects extends true
    ? keyof Res | KeysBuilderWithReturnObjects<Res>
    : KeysBuilderWithoutReturnObjects<Res>
  : string;

type KeysWithReturnObjects = {
  [Ns in FlatNamespace]: WithOrWithoutPlural<KeysBuilder<Resources[Ns], true>>;
};
type KeysWithoutReturnObjects = {
  [Ns in FlatNamespace]: WithOrWithoutPlural<KeysBuilder<Resources[Ns], false>>;
};

type ResourceKeys<WithReturnObjects = _ReturnObjects> =
  WithReturnObjects extends true
    ? KeysWithReturnObjects
    : KeysWithoutReturnObjects;

/************************************************************************
 * Parse t function keys based on the namespace, options and key prefix *
 ************************************************************************/
type KeysByTOptions<TOpt extends TOptions> = TOpt["returnObjects"] extends true
  ? ResourceKeys<true>
  : ResourceKeys;

type NsByTOptions<
  Ns extends Namespace,
  TOpt extends TOptions
> = TOpt["ns"] extends Namespace ? TOpt["ns"] : Ns;

type ParseKeysByKeyPrefix<Keys, KPrefix> = KPrefix extends string
  ? Keys extends `${KPrefix}${_KeySeparator}${infer Key}`
    ? Key
    : never
  : Keys;

type ParseKeysByNamespaces<
  Ns extends Namespace,
  Keys
> = Ns extends readonly (infer UnionNsps)[]
  ? UnionNsps extends keyof Keys
    ? AppendNamespace<UnionNsps, Keys[UnionNsps]>
    : never
  : never;

type ParseKeysByFallbackNs<Keys extends $Dictionary> =
  _FallbackNamespace extends false
    ? never
    : _FallbackNamespace extends (infer UnionFallbackNs extends string)[]
    ? Keys[UnionFallbackNs]
    : Keys[_FallbackNamespace & string];

/**
 * @MyComment
 * 4. inferを利用したテクニック
 * contextが存在している場合、contextを削ぎ落としたテンプレートリテラル型を返すようになっている
 * @example
 * FilterKeysByContext<"username_male_age", { context: "male" }> => username_age
 * FilterKeysByContext<"username_male_age", {}> => username_male_age
 * FilterKeysByContext<"username_male", { context: "male" }> => username
 *
 * TOpt["context"] => 任意のcontext
 * @example 'male'
 *
 * _ContextSeparator => contextを文字列中で分離する任意の文字列
 * @default `_` だが変更可能
 */
// prettier-ignore
type FilterKeysByContext<
  Keys,
  TOpt extends TOptions
  > =
  // contextはstringか？
  TOpt["context"] extends string
  // yesの場合、coontextは `hoge_{context}_fuga` のような形か？
  // Prefixはhogeと推論され、Suffixは_fugaと推論される
  // `${_ContextSeparator}${TOpt["context"]}` は _{context} の部分である
    ? Keys extends `${infer Prefix}${_ContextSeparator}${TOpt["context"]}${infer Suffix}`
      // yesの場合、 hoge のような型を返す
      ? `${Prefix}${Suffix}`
      // noの場合、不正な指定で推論不可能なのでneverを返す
      : never
  // noの場合、contextは存在しないのでそのままkeyを返す
  : Keys;

type A = FilterKeysByContext<"username_male_age", { context: "male" }>;
type B = FilterKeysByContext<"username_male_age", {}>;
type C = FilterKeysByContext<"username_male", { context: "male" }>;

export type ParseKeys<
  Ns extends Namespace = DefaultNamespace,
  TOpt extends TOptions = {},
  KPrefix = undefined,
  Keys extends $Dictionary = KeysByTOptions<TOpt>,
  ActualNS extends Namespace = NsByTOptions<Ns, TOpt>
> = $IsResourcesDefined extends true
  ? FilterKeysByContext<
      | ParseKeysByKeyPrefix<Keys[$FirstNamespace<ActualNS>], KPrefix>
      | ParseKeysByNamespaces<ActualNS, Keys>
      | ParseKeysByFallbackNs<Keys>,
      TOpt
    >
  : string;

/*********************************************************
 * Parse t function return type and interpolation values *
 *********************************************************/
type ParseInterpolationValues<Ret> =
  Ret extends `${string}${_InterpolationPrefix}${infer Value}${_InterpolationSuffix}${infer Rest}`
    ?
        | (Value extends `${infer ActualValue},${string}` ? ActualValue : Value)
        | ParseInterpolationValues<Rest>
    : never;
type InterpolationMap<Ret> = Record<
  $PreservedValue<ParseInterpolationValues<Ret>, string>,
  unknown
>;

type ParseTReturnPlural<
  Res,
  Key,
  KeyWithPlural = `${Key & string}${_PluralSeparator}${PluralSuffix}`,
  KeyWithOrdinalPlural = `${Key &
    string}${_PluralSeparator}ordinal${_PluralSeparator}${PluralSuffix}`
> = Res[(KeyWithOrdinalPlural | KeyWithPlural | Key) & keyof Res];

type ParseTReturn<Key, Res> =
  Key extends `${infer K1}${_KeySeparator}${infer RestKey}`
    ? ParseTReturn<RestKey, Res[K1 & keyof Res]>
    : ParseTReturnPlural<Res, Key>;

type TReturnOptionalNull = _ReturnNull extends true ? null : never;
type TReturnOptionalObjects<TOpt extends TOptions> = _ReturnObjects extends true
  ? $SpecialObject | string
  : TOpt["returnObjects"] extends true
  ? $SpecialObject
  : string;
type DefaultTReturn<TOpt extends TOptions> =
  | TReturnOptionalObjects<TOpt>
  | TReturnOptionalNull;

type KeyWithContext<Key, TOpt extends TOptions> = TOpt["context"] extends string
  ? `${Key & string}${_ContextSeparator}${TOpt["context"]}`
  : Key;

export type TFunctionReturn<
  Ns extends Namespace,
  Key,
  TOpt extends TOptions,
  ActualNS extends Namespace = NsByTOptions<Ns, TOpt>,
  ActualKey = KeyWithContext<Key, TOpt>
> = $IsResourcesDefined extends true
  ? ActualKey extends `${infer Nsp}${_NsSeparator}${infer RestKey}`
    ? ParseTReturn<RestKey, Resources[Nsp & keyof Resources]>
    : ParseTReturn<ActualKey, Resources[$FirstNamespace<ActualNS>]>
  : DefaultTReturn<TOpt>;

export type TFunctionDetailedResult<T = string, TOpt extends TOptions = {}> = {
  /**
   * The plain used key
   */
  usedKey: string;
  /**
   * The translation result.
   */
  res: T;
  /**
   * The key with context / plural
   */
  exactUsedKey: string;
  /**
   * The used language for this translation.
   */
  usedLng: string;
  /**
   * The used namespace for this translation.
   */
  usedNS: string;
  /**
   * The parameters used for interpolation.
   */
  usedParams: InterpolationMap<T> & { count?: TOpt["count"] };
};

type TFunctionReturnOptionalDetails<
  Ret,
  TOpt extends TOptions
> = TOpt["returnDetails"] extends true
  ? TFunctionDetailedResult<Ret, TOpt>
  : Ret;

type AppendKeyPrefix<Key, KPrefix> = KPrefix extends string
  ? `${KPrefix}${_KeySeparator}${Key & string}`
  : Key;

/**************************
 * T function declaration *
 **************************/

/**
 * @MyComment 3. 最終的にt関数に与えられる型
 * ここで拡張されたTypeOptionsを利用して型をつけている
 */
export interface TFunction<
  Ns extends Namespace = DefaultNamespace,
  KPrefix = undefined
> {
  $TFunctionBrand: $IsResourcesDefined extends true
    ? `${$FirstNamespace<Ns>}`
    : never;

  <
    const Key extends ParseKeys<Ns, TOpt, KPrefix> | TemplateStringsArray,
    const TOpt extends TOptions,
    Ret extends TFunctionReturn<Ns, AppendKeyPrefix<Key, KPrefix>, TOpt>,
    const ActualOptions extends TOpt & InterpolationMap<Ret> = TOpt &
      InterpolationMap<Ret>
  >(
    ...args:
      | [key: Key | Key[], options?: ActualOptions]
      | [
          key: string | string[],
          options: TOpt & $Dictionary & { defaultValue: string }
        ]
      | [
          key: string | string[],
          defaultValue: string,
          options?: TOpt & $Dictionary
        ]
  ): TFunctionReturnOptionalDetails<Ret, TOpt>;
}

export type KeyPrefix<Ns extends Namespace> =
  | ResourceKeys<true>[$FirstNamespace<Ns>]
  | undefined;
