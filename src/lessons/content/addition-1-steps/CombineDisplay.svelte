<script>
  import { onDestroy } from 'svelte'
  import gsap from 'gsap'
  import GroupsDisplay from './GroupsDisplay.svelte'

  let { groups } = $props()

  let ctx

  function animateCombine(node) {
    ctx = gsap.context(() => {
      const groupsRow = node.querySelector('.groups-row')
      const operator = node.querySelector('.operator')
      const boxes = node.querySelectorAll('.group-box')
      if (!groupsRow || boxes.length < 2) return

      const operatorWidth = operator.offsetWidth
      gsap.set(operator, { width: operatorWidth, overflow: 'hidden' })

      const headers = node.querySelectorAll('.group-box h3')

      const tl = gsap.timeline({ delay: 0.4 })
      tl.to(operator, {
        width: 0,
        opacity: 0,
        marginLeft: 0,
        marginRight: 0,
        duration: 0.4,
        ease: 'power1.in',
      }).to(
        groupsRow,
        {
          gap: '0px',
          duration: 0.5,
          ease: 'power2.inOut',
        },
        '<'
      ).to(
        boxes[0],
        { paddingRight: '0.25rem', duration: 0.5, ease: 'power2.inOut' },
        '<'
      ).to(
        boxes[1],
        { paddingLeft: '0.25rem', duration: 0.5, ease: 'power2.inOut' },
        '<'
      ).to(
        headers,
        { opacity: 0, height: 0, marginBottom: 0, duration: 0.3, ease: 'power1.in' },
        '<'
      ).set(boxes[0], {
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        borderRight: 'none',
      }).set(boxes[1], {
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        borderLeft: 'none',
      })
    }, node)
  }

  onDestroy(() => {
    ctx?.revert()
  })
</script>

<div use:animateCombine>
  <GroupsDisplay {groups} />
</div>
