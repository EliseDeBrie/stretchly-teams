class VersionChecker {
  latest () {
    return fetch(
      'https://api.github.com/repos/EliseDeBrie/stretchly-teams/releases/latest',
      {
        method: 'GET',
        headers: { 'User-Agent': 'EliseDeBrie/stretchly-teams' },
        mode: 'cors',
        cache: 'default'
      })
      .then(response => response.text())
      .then(body => JSON.parse(body).tag_name)
      .catch(() => {})
  }
}

export default VersionChecker
