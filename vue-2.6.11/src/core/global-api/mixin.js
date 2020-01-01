/* @flow */

import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    /*mergeOptions合并optiuons*/
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
