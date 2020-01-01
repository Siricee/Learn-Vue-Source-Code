/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey               /*标记是否为静态属性*/
let isPlatformReservedTag     /*标记是否是平台保留的标签*/

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
/*
  将AST树进行优化
  优化的目标：生成模板AST树，检测不需要进行DOM改变的静态子树。
  一旦检测到这些静态树，我们就能做以下这些事情：
  1.把它们变成常数，这样我们就再也不需要每次重新渲染时创建新的节点了。
  2.在patch的过程中直接跳过。
 */
export function optimize (root: ?ASTElement, options: CompilerOptions) {
  if (!root) return
  /*标记是否为静态属性*/
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  /*标记是否是平台保留的标签*/
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  markStatic(root)
  // second pass: mark static roots.
  markStaticRoots(root, false)
}

/*静态属性的map表*/
function genStaticKeys (keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
    (keys ? ',' + keys : '')
  )
}

function markStatic (node: ASTNode) {
  node.static = isStatic(node)
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 不要使组件slot成为静态的，避免下面这两种情况：
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) {
        node.static = false
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}

function markStaticRoots (node: ASTNode, isInFor: boolean) {
  if (node.type === 1) {
    /*标记static的或者有v-once指令同时处于for循环中的节点*/
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    // 为了使节点有资格作为静态根节点，它应具有不只是静态文本的子节点。 否则，优化的成本将超过收益，最好始终将其更新。
    if (node.static &&               // 节点本身必须是静态节点；
      node.children.length &&        // 必须拥有子节点 `children`
      !(node.children.length === 1 &&node.children[0].type === 3)  // 子节点不能只是只有一个文本节点
    ) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    /*遍历子节点*/
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    /*
      ifConditions存储了if条件。
      是一个数组，格式为[{exp: xxx, block:xxx}, {exp: xxx, block:xxx}, {exp: xxx, block:xxx}]
      block存储了element，exp存储了表达式。
    */
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}

/*判断一个node节点是否是static的*/
function isStatic (node: ASTNode): boolean {
  if (node.type === 2) { // 包含变量的动态文本节点
    return false
  }
  if (node.type === 3) { // 不包含变量的纯文本节点
    return true
  }
  return !!(node.pre || (
    !node.hasBindings && // 不能使用动态绑定语法
    !node.if && !node.for && // 不能使用`v-if`、`v-else`、`v-for`指令
    !isBuiltInTag(node.tag) && // 不能是内置组件，即标签名不能是`slot`和`component`
    isPlatformReservedTag(node.tag) && // 标签名必须是平台保留标签，即不能是组件
    !isDirectChildOfTemplateFor(node) && // 当前节点的父节点不能是带有 `v-for` 的 `template` 标签
    Object.keys(node).every(isStaticKey)  // 节点的所有属性的 `key` 都必须是静态节点才有的 `key`
  ))
}

function isDirectChildOfTemplateFor (node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
