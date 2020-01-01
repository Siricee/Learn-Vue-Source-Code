/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
// 新建一个继承于Array的对象,作为拦截器
export const arrayMethods = Object.create(arrayProto)
// 改变数组自身内容的7个方法

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
/*
  这里重写了数组的这些方法，
  在保证不污染原生数组原型的情况下重写数组的这些方法，
  截获数组的成员发生的变化，
  执行原生数组操作的同时dep通知关联的所有观察者进行响应式处理
*/
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]     // 缓存原生方法
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args)  /*调用原生的数组方法*/
    /*数组新插入的元素需要重新进行observe才能响应式*/
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    /*dep通知所有注册的观察者进行响应式处理*/
    ob.dep.notify()
    return result
  })
})
