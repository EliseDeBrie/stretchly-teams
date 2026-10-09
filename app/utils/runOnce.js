function createRunOnce () {
  let actionTaken = false
  return (action) => async () => {
    if (actionTaken) return
    actionTaken = true
    await action()
  }
}

export default createRunOnce
