// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import Log from "../../core/Log";

import enUSMessages from "../../locales/en_US.json";
import bgBGMessages from "../../locales/bg_BG.json";
import csCZMessages from "../../locales/cs_CZ.json";
import daDKMessages from "../../locales/da_DK.json";
import deDEMessages from "../../locales/de_DE.json";
import elGRMessages from "../../locales/el_GR.json";
import esESMessages from "../../locales/es_ES.json";
import esMXMessages from "../../locales/es_MX.json";
import fiFIMessages from "../../locales/fi_FI.json";
import frCAMessages from "../../locales/fr_CA.json";
import frFRMessages from "../../locales/fr_FR.json";
import huHUMessages from "../../locales/hu_HU.json";
import idIDMessages from "../../locales/id_ID.json";
import itITMessages from "../../locales/it_IT.json";
import jaJPMessages from "../../locales/ja_JP.json";
import koKRMessages from "../../locales/ko_KR.json";
import nbNOMessages from "../../locales/nb_NO.json";
import nlNLMessages from "../../locales/nl_NL.json";
import plPLMessages from "../../locales/pl_PL.json";
import ptBRMessages from "../../locales/pt_BR.json";
import ptPTMessages from "../../locales/pt_PT.json";
import ruRUMessages from "../../locales/ru_RU.json";
import skSKMessages from "../../locales/sk_SK.json";
import svSEMessages from "../../locales/sv_SE.json";
import trTRMessages from "../../locales/tr_TR.json";
import ukUAMessages from "../../locales/uk_UA.json";
import zhCNMessages from "../../locales/zh_CN.json";
import zhTWMessages from "../../locales/zh_TW.json";
import pseudoMessages from "../../locales/pseudo.json";

type Messages = Record<string, string>;

const messages: Record<string, Messages> = {
  en_US: enUSMessages,
  bg_BG: bgBGMessages,
  cs_CZ: csCZMessages,
  da_DK: daDKMessages,
  de_DE: deDEMessages,
  el_GR: elGRMessages,
  es_ES: esESMessages,
  es_MX: esMXMessages,
  fi_FI: fiFIMessages,
  fr_CA: frCAMessages,
  fr_FR: frFRMessages,
  hu_HU: huHUMessages,
  id_ID: idIDMessages,
  it_IT: itITMessages,
  ja_JP: jaJPMessages,
  ko_KR: koKRMessages,
  nb_NO: nbNOMessages,
  nl_NL: nlNLMessages,
  pl_PL: plPLMessages,
  pt_BR: ptBRMessages,
  pt_PT: ptPTMessages,
  ru_RU: ruRUMessages,
  sk_SK: skSKMessages,
  sv_SE: svSEMessages,
  tr_TR: trTRMessages,
  uk_UA: ukUAMessages,
  zh_CN: zhCNMessages,
  zh_TW: zhTWMessages,
  pseudo: pseudoMessages,
};

export interface ILocalizationProviderProps {
  children: ReactNode;
  locale?: string;
}

export const LocalizationProvider: React.FC<ILocalizationProviderProps> = ({ children, locale = "en_US" }) => {
  const selectedLocale = messages[locale] ? locale : "en_US";
  const selectedMessages = { ...enUSMessages, ...messages[selectedLocale] };
  const bcp47Locale = selectedLocale.replace("_", "-");

  return (
    <IntlProvider
      locale={bcp47Locale}
      messages={selectedMessages}
      defaultLocale="en-US"
      onError={(err) => {
        if (process.env.NODE_ENV === "development") {
          Log.debug("react-intl error: " + err);
        }
      }}
    >
      {children}
    </IntlProvider>
  );
};

export function getUserLocale(): string {
  // Allow ?locale=xx_YY override for testing (e.g. ?locale=pseudo)
  const urlParams = new URLSearchParams(window.location.search);
  const overrideLocale = urlParams.get("locale");
  if (overrideLocale && messages[overrideLocale]) {
    return overrideLocale;
  }

  const browserLocale = navigator.language || "en";
  const fileFormatLocale = browserLocale.replace("-", "_");

  if (messages[fileFormatLocale]) {
    return fileFormatLocale;
  }

  if (messages[browserLocale]) {
    return browserLocale;
  }

  const baseLocale = browserLocale.split(/[-_]/)[0];
  if (messages[baseLocale]) {
    return baseLocale;
  }

  return "en_US";
}
