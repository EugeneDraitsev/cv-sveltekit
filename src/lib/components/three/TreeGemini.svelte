<script lang="ts">
  import { T } from '@threlte/core';
  import { BufferGeometry, Vector3, Float32BufferAttribute, CatmullRomCurve3 } from 'three';

  export let height = 5;
  export let leafColor = 'green';
  export let trunkColor = 'brown';
  export let branchCount = 5;

  // Function to create trunk and branches geometry
  function createTreeGeometry(height: number, branchCount: number) {
    const geometry = new BufferGeometry();
    const vertices = [];
    const indices = [];

    // Trunk vertices
    vertices.push(0, 0, 0);
    vertices.push(0.5, 0, 0.5);
    vertices.push(0.5, 0, -0.5);
    vertices.push(-0.5, 0, -0.5);
    vertices.push(-0.5, 0, 0.5);
    vertices.push(0, height, 0);

    // Trunk indices
    indices.push(0, 1, 2);
    indices.push(0, 2, 3);
    indices.push(0, 3, 4);
    indices.push(0, 4, 1);
    indices.push(5, 1, 2);
    indices.push(5, 2, 3);
    indices.push(5, 3, 4);
    indices.push(5, 4, 1);

    let currentIndex = 6; // Starting index for branches

    for (let i = 0; i < branchCount; i++) {
      const angle = (i / branchCount) * Math.PI * 2;
      const x = Math.sin(angle) * 0.5;
      const z = Math.cos(angle) * 0.5;
      const branchHeight = height / 2 + (Math.random() * height) / 2;

      // Create a curved path for the branch with more points
      const curve = new CatmullRomCurve3([
        new Vector3(x, height / 2 + Math.random(), z),
        new Vector3(x * 1.5, height / 2 + (Math.random() * height) / 4, z * 1.5),
        new Vector3(x * 2.5, branchHeight - (Math.random() * height) / 4, z * 2.5),
        new Vector3(x * 3, branchHeight, z * 3),
      ]);

      const curvePoints = curve.getPoints(40); // Increased number of points

      // Create branch segments with adjusted width
      for (let j = 0; j < curvePoints.length - 1; j++) {
        const p1 = curvePoints[j];
        const p2 = curvePoints[j + 1];

        const direction = new Vector3().subVectors(p2, p1).normalize();

        // Adjust perpendicular vectors for smoother branches
        const perpendicular1 = new Vector3()
          .crossVectors(direction, new Vector3(0, 1, 0))
          .normalize()
          .multiplyScalar(0.1 - j * 0.001);
        const perpendicular2 = new Vector3()
          .crossVectors(direction, perpendicular1)
          .normalize()
          .multiplyScalar(0.1 - j * 0.001);

        // Generate vertices for the branch segment
        vertices.push(p1.x + perpendicular1.x, p1.y + perpendicular1.y, p1.z + perpendicular1.z);
        vertices.push(p1.x + perpendicular2.x, p1.y + perpendicular2.y, p1.z + perpendicular2.z);
        vertices.push(p2.x + perpendicular1.x, p2.y + perpendicular1.y, p2.z + perpendicular1.z);
        vertices.push(p2.x + perpendicular2.x, p2.y + perpendicular2.y, p2.z + perpendicular2.z);

        // Branch indices
        indices.push(currentIndex, currentIndex + 1, currentIndex + 2);
        indices.push(currentIndex + 1, currentIndex + 2, currentIndex + 3);

        currentIndex += 4;
      }
    }

    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    return geometry;
  }

  // Function to get points along a branch
  function getBranchPoints(index: number, height: number, branchCount: number) {
    const angle = (index / branchCount) * Math.PI * 2;
    const x = Math.sin(angle) * 0.5;
    const z = Math.cos(angle) * 0.5;
    const branchHeight = height / 2 + (Math.random() * height) / 2;

    const curve = new CatmullRomCurve3([
      new Vector3(x, height / 2 + Math.random(), z),
      new Vector3(x * 2, height / 2 + (Math.random() * height) / 2, z * 2),
      new Vector3(x * 3, branchHeight, z * 3),
    ]);

    return curve.getPoints(20);
  }
</script>

<T.Mesh geometry={createTreeGeometry(height, branchCount)}>
  <T.MeshStandardMaterial color={trunkColor} />
</T.Mesh>

<T.Mesh position={[0, height, 0]} scale={0.8}>
  <T.IcosahedronGeometry args={[1, 1]} />
  <T.MeshStandardMaterial color={leafColor} />
</T.Mesh>

{#each Array(branchCount) as _, i}
  <T.Group>
    {#each getBranchPoints(i, height, branchCount) as point, j}
      {#if j > 0 && j % 4 === 0}
        <T.Mesh position={[point.x, point.y, point.z]} scale={Math.random() * 0.3 + 0.3}>
          <T.IcosahedronGeometry args={[1, 1]} />
          <T.MeshStandardMaterial color={leafColor} />
        </T.Mesh>
      {/if}
    {/each}
  </T.Group>
{/each}
